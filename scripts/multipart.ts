import {DuploConfig, DuploInstance, ProcessExport, ProcessExtractObj, Request, Response, zod} from "@duplojs/duplojs";
import busboy from "busboy";
import {createWriteStream, existsSync, mkdirSync, rmSync} from "fs";
import {rename, unlink} from "fs/promises";
import {resolve} from "path";
import {ZodError, ZodType} from "zod";

export interface DuploMultipartOptions {
	maxSize?: number;
	uploadFolder?: string;
}

export type DuploMultipartFileObject = {
	properties: busboy.FileInfo, 
	save: (path: string) => Promise<void>, 
	unlink: () => Promise<void>,
}

export interface DuploMultipartFormDataParams<
	files extends Record<string, number>,
	fields extends Record<string, ZodType>
> {
	files?: files;
	fields?: fields;
	maxSize?: number;
	uploadFolder?: string;
	prefixTempFile?: string;
	maxFileSize?: number;
	maxFieldSize?: number;
}

export type OutputZodType<zodType extends ZodType> = zodType extends ZodType<infer input, infer def, infer output> ? output : never;

export interface DuploMultipartRequest extends Request {
	tempMultipartFilenames?: string[];
}

function duploMultipart(instance: DuploInstance<DuploConfig>, options?: DuploMultipartOptions){
	return <
		files extends Record<string, number>,
		fields extends Record<string, ZodType>
	>(multipartFormDataParams: DuploMultipartFormDataParams<files, fields>) => {
		const processProperties = {
			files: multipartFormDataParams.files || {} as Record<string, number>,
			fields: multipartFormDataParams.fields || {} as Record<string, ZodType>,
			maxSize: multipartFormDataParams.maxSize || options?.maxSize || Infinity,
			uploadFolder: multipartFormDataParams.uploadFolder || options?.uploadFolder || "./upload",
			prefixTempFile: multipartFormDataParams.prefixTempFile || "",
			maxFileSize: multipartFormDataParams.maxFileSize || Infinity,
			maxFieldSize: multipartFormDataParams.maxFieldSize || 1048576,

			maxFiles: Object.values(multipartFormDataParams.files || {}).reduce((p, c) => p + c, 0),
		};

		if(existsSync(processProperties.uploadFolder)) rmSync(processProperties.uploadFolder, {recursive: true, force: true});
		mkdirSync(processProperties.uploadFolder, {recursive: true});

		const process = instance.createProcess<
			DuploMultipartRequest, 
			Response,
			ProcessExtractObj,
			typeof processProperties,
			any
		>("duploMultipart", {options: processProperties})
		.hook("afterSend", request => request.tempMultipartFilenames?.forEach(value => unlink(value).catch(console.error)))
		.extract(
			{
				headers: {
					"content-type": zod.string().startsWith("multipart/form-data"),
					"content-length": zod.coerce.number(),
				}
			},
			(response, type, index) => response.code(400).info(`Bad ${index}`).send()
		)
		.cut(({pickup}, response) => 
			pickup("content-length") > pickup("options").maxSize ? 
				response.code(400).info("content-length too large").send() : 
				undefined
		)
		.custom(async({pickup}, request, response) => {
			const processProperties = pickup("options");

			const fields: any = {};
			const multipartGetFields: () => {[key in keyof fields]: OutputZodType<fields[key]>} = () => Object.entries(processProperties.fields).reduce(
				(pv, [key, value]) => {
					try {
						pv[key] = value.parse(fields[key]);
					}
					catch (error){
						if(error instanceof ZodError) response.code(400).info(`TYPE_ERROR.multipartProperties.${key}`).send();
						else throw error;
					}
					return pv;
				}, 
				{} as any
			);
			
			if(processProperties.files) request.tempMultipartFilenames = [];
			const multipartFile: Record<keyof files, DuploMultipartFileObject[]> = {} as Record<keyof files, any>;
			await new Promise((res, rej) =>  
				request.rawRequest.pipe(
					busboy({
						headers: request.rawRequest.headers, 
						limits: {
							files: processProperties.maxFiles,
							fileSize: processProperties.maxFileSize,
							fieldSize: processProperties.maxFieldSize,
						}
					})
					.on("file", (name, file, properties) => {
						if(!name || !processProperties.files[name]) return file.resume();
						if(!multipartFile[name]) multipartFile[name as keyof files] = [];
						if(multipartFile[name].length === processProperties.files[name]) return file.resume();

						const tempFileName = resolve(processProperties.uploadFolder, `${processProperties.prefixTempFile}${Date.now()}`);
						request.tempMultipartFilenames?.push(tempFileName);
						const writeStream = createWriteStream(tempFileName, {flags: "a"});
						file.on("data", data => writeStream.write(data))
						.on("error", rej)
						.on("close", () => multipartFile[name as keyof files].push({
							properties,
							save: (path) => {
								request.tempMultipartFilenames?.splice(request.tempMultipartFilenames?.indexOf(tempFileName) || -1, 1);
								return rename(tempFileName, path);
							},
							unlink: () => {
								request.tempMultipartFilenames?.splice(request.tempMultipartFilenames?.indexOf(tempFileName) || -1, 1);
								return unlink(tempFileName);
							},
								
						}))
						.resume();
					})
					.on("field", (name, value) => fields[name] = value)
					.on("error", rej)
					.on("close", res)
				)
			);
		
			return {
				multipartGetFields,
				multipartFile
			};
		})
		.build(["multipartGetFields", "multipartFile"]);

		const processParams = {
			pickup: ["multipartGetFields", "multipartFile"] as typeof process extends ProcessExport<
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

export default duploMultipart;
