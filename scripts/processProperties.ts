import {zod} from "@duplojs/duplojs";
import {DuploMultipartFormDataParams, fileParameters} from "./multipart";

export class MultipartProcessProperties<
	_files extends Record<string, fileParameters>,
	_fields extends Record<string, zod.ZodType>
>{
	constructor(
		public files = {} as Record<keyof _files, fileParameters>,
		public fields = {} as Record<keyof _fields, zod.ZodType>,
		public maxSize = Infinity,
		public uploadFolder = "./upload",
		public prefixTempFile = "",
		public maxFileSize = Infinity,
		public maxFieldSize = 1048576,
		public maxFiles = 0,
		public catchExtractError: 
			Exclude<DuploMultipartFormDataParams<_files, _fields>["catchExtractError"], undefined> = ((response, key) => response.code(400).info(`Bad ${key}`).send()),
		public catchTooLargeError: 
			Exclude<DuploMultipartFormDataParams<_files, _fields>["catchTooLargeError"], undefined> = ((response) => response.code(400).info("content-length too large").send()),
		public catchFieldsError:
			Exclude<DuploMultipartFormDataParams<_files, _fields>["catchFieldsError"], undefined> = ((response, key) => response.code(400).info(`TYPE_ERROR.multipartProperties.${key}`).send()),
		public catchError:
			Exclude<DuploMultipartFormDataParams<_files, _fields>["catchError"], undefined> = ((response, error) => response.code(500).info("INTERNAL_SERVER_ERROR").send(error.stack)),
	){}
}
