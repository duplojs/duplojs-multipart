import Duplo, {zod} from "@duplojs/duplojs";
import duploMultipart from "../../scripts/multipart";
import {parentPort} from "worker_threads";
import {readdirSync} from "fs";

const duplo = Duplo({port: 1506, host: "0.0.0.0"});

const multipartProcess = duplo.use(duploMultipart, {uploadFolder: __dirname + "/../upload"});

duplo.declareRoute("POST", "/test/1")
.process(
	...multipartProcess({
		fields: {
			userId: zod.coerce.number(),
		},
		maxSize: 124,
		catchFieldsError: (response, key) => response.code(400).info(key).send(),
		catchTooLargeError: (response) => response.code(400).info("big").send(),
		catchExtractError: (response, key) => response.code(400).info("bad header").send(),
	})
)
.handler(async({pickup}, response) => {
	const {userId} = pickup("multipartGetFields")();

	response.code(200).info("s").send();
});

duplo.declareRoute("POST", "/test/2")
.hook("onError", (req, res, error) => parentPort?.postMessage(error))
.process(
	...multipartProcess({
		files: {
			avatar: {max: 1},
		},
		uploadFolder: __dirname + "/../upload/myfolder",
		prefixTempFile: "tmp-",
	})
)
.handler(async({pickup}, response) => {
	parentPort?.postMessage("count files upload " + readdirSync(__dirname + "/../upload/myfolder").length);
	parentPort?.postMessage("prefix " + pickup("multipartGetFile").avatar[0].tempFileName.split("/").reverse()[0].startsWith("tmp-"));
	response.code(200).info("s").send();
});

duplo.launch(() => parentPort?.postMessage("ready"));
