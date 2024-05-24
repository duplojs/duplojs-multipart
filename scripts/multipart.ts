import {DuploConfig, DuploInstance, Process, Request, Response, zod} from "@duplojs/duplojs";
import busboy from "busboy";
import {createWriteStream, existsSync, mkdirSync, rmSync} from "fs";
import {rename, unlink} from "fs/promises";
import {resolve} from "path";
import packageJson from "../package.json";
import {MultipartProcessProperties} from "./processProperties";
export {MultipartProcessProperties};

declare module "@duplojs/duplojs" {
	interface Plugins {
		"@duplojs/multipart": {version: string},
	}
}

export interface DuploMultipartOptions {
	maxSize?: number;
	uploadFolder?: string;
	catchExtractError?: (response: Response, key: string, error: Error) => void;
	catchTooLargeError?: (response: Response) => void;
	catchFieldsError?: (response: Response, key: string, error: zod.ZodError) => void;
	catchError?: (response: Response, error: Error) => void;
}

export type DuplomultipartGetFileObject = {
	properties: busboy.FileInfo, 
	save: (path: string) => Promise<void>, 
	unlink: () => Promise<void>,
	tempFileName: string,
}

export type fileParameters = {max: number, mimeType?: string[]};

export interface DuploMultipartFormDataParams<
	files extends Record<string, fileParameters>,
	fields extends Record<string, zod.ZodType>
> extends DuploMultipartOptions{
	files?: files & Record<string, fileParameters>;
	fields?: fields & Record<string, zod.ZodType>;
	prefixTempFile?: string;
	maxFileSize?: number;
	maxFieldSize?: number;
}

export type OutputZodType<zodType extends zod.ZodType> = zodType extends zod.ZodType<infer output> ? output : never;

export interface DuploMultipartRequest extends Request {
	tempMultipartFilenames?: string[];
}

export type multipartGetFields<fields extends Record<string, zod.ZodType>> = () => {[key in keyof fields]: OutputZodType<fields[key]>};

function duploMultipart(instance: DuploInstance<DuploConfig>, options?: DuploMultipartOptions){
	instance.plugins["@duplojs/multipart"] = {version: packageJson.version};

	return function <
		files extends Record<string, fileParameters> = {},
		fields extends Record<string, zod.ZodType> = {}
	>(multipartFormDataParams: DuploMultipartFormDataParams<files, fields>){
		const processProperties = new MultipartProcessProperties<files, fields>(
			multipartFormDataParams.files,
			multipartFormDataParams.fields,
			multipartFormDataParams.maxSize || options?.maxSize,
			multipartFormDataParams.uploadFolder || options?.uploadFolder,
			multipartFormDataParams.prefixTempFile,
			multipartFormDataParams.maxFileSize,
			multipartFormDataParams.maxFieldSize,
			Object.values(multipartFormDataParams.files || {}).reduce((p, c) => p + c.max, 0),
			multipartFormDataParams.catchExtractError || options?.catchExtractError,
			multipartFormDataParams.catchTooLargeError || options?.catchTooLargeError,
			multipartFormDataParams.catchFieldsError || options?.catchFieldsError,
			multipartFormDataParams.catchError || options?.catchError,
		);

		if(existsSync(processProperties.uploadFolder)) rmSync(processProperties.uploadFolder, {recursive: true, force: true});
		mkdirSync(processProperties.uploadFolder, {recursive: true});

		const process = instance
		.createProcess<DuploMultipartRequest>(`processMultipart${duploMultipart.count++}`, processProperties)
		.hook("afterSend", request => {
			request.tempMultipartFilenames?.forEach(value => unlink(value).catch(console.error));
		})
		.extract(
			{
				headers: {
					"content-type": zod.string().startsWith("multipart/form-data"),
					"content-length": zod.coerce.number(),
				}
			},
			(response, type, index, error) => processProperties.catchExtractError(response, index, error)
		)
		.cut(({pickup}, response) => {
			if(pickup("content-length") > processProperties.maxSize){
				processProperties.catchTooLargeError(response);
			}
		})
		.cut(
			async({}, response, request) => {
				const fields = {} as Record<keyof fields, any>;
				const multipartGetFields: multipartGetFields<fields> = () => Object.entries(processProperties.fields).reduce(
					(pv, [key, value]) => {
						try {
							pv[key] = value.parse(fields[key]);
						}
						catch (error){
							if(error instanceof zod.ZodError) processProperties.catchFieldsError(response, key as string, error);
							else processProperties.catchError(response, error as Error);
						}
						return pv;
					}, 
					{} as any
				);
			
				if(processProperties.files) request.tempMultipartFilenames = [];
				const multipartGetFile = Object.keys(processProperties.files).reduce(
					(pv, c: keyof files) => {
						pv[c] = [];
						return pv;
					}, 
					{} as Record<keyof files, DuplomultipartGetFileObject[]>
				);

				try {
					await new Promise((res, rej) => {  
						const promisesList: Promise<unknown>[] = [];

						request.rawRequest.pipe(
							busboy({
								headers: request.rawRequest.headers, 
								limits: {
									files: processProperties.maxFiles,
									fileSize: processProperties.maxFileSize,
									fieldSize: processProperties.maxFieldSize,
								}
							})
							.on("file", (name: keyof files, file, properties) => {
								if(
									!name || 
									!properties.filename || 
									!processProperties.files[name] ||
									multipartGetFile[name]?.length === processProperties.files[name].max ||
									(
										processProperties.files[name].mimeType &&
										!processProperties.files[name].mimeType?.includes(properties.mimeType)
									)
								){
									return file.resume();
								}

								const tempFileName = resolve(processProperties.uploadFolder, `${processProperties.prefixTempFile}${Date.now()}`);
								request.tempMultipartFilenames?.push(tempFileName);

								const writeStream = createWriteStream(tempFileName, {flags: "a"});
								file.pipe(writeStream.on("error", rej)).on("error", rej);

								promisesList.push(
									new Promise<undefined>(r => {
										writeStream.on("close", () => {
											multipartGetFile[name].push({
												properties,
												save: (path) => {
													request.tempMultipartFilenames?.splice(request.tempMultipartFilenames?.indexOf(tempFileName), 1);
													return rename(tempFileName, path);
												},
												unlink: () => {
													request.tempMultipartFilenames?.splice(request.tempMultipartFilenames?.indexOf(tempFileName), 1);
													return unlink(tempFileName);
												},
												tempFileName,
											});
											
											r(undefined);
										});
									})
								);
							})
							.on("field", (name, value) => {
								if(processProperties.fields[name]){
									fields[name as keyof fields] = value;
								}
							})
							.on("error", rej)
							.on("close", () => Promise.all(promisesList).then(res))
						);
					});
				
				}
				catch (error){
					processProperties.catchError(response, error as Error);
				}
		
				return {
					multipartGetFields,
					multipartGetFile,
				};
			},
			["multipartGetFields", "multipartGetFile"]
		)
		.build(["multipartGetFields", "multipartGetFile"]);

		const processParams = {
			pickup: ["multipartGetFields", "multipartGetFile"] as typeof process extends Process<
				infer input, 
				infer options, 
				infer extractObj, 
				infer floor, 
				infer drop
			> ? drop[] : never
		};

		return [process, processParams] as [typeof process, typeof processParams];
	};
}

duploMultipart.count = 0;

export default duploMultipart;
