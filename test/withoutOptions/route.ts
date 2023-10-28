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
			username: zod.string().optional(),
		},
	})
)
.handler(async({pickup}, response) => {
	const {userId, username} = pickup("multipartGetFields")();
	
	parentPort?.postMessage("userId " + userId);
	parentPort?.postMessage("username " + username);

	response.code(200).info("s").send();
});

duplo.declareRoute("POST", "/test/2")
.hook("onError", (req, res, error) => parentPort?.postMessage(error))
.hook("afterSend", () => {
	setTimeout(
		() => {
			parentPort?.postMessage("count files upload " + readdirSync(__dirname + "/../upload/").length);
		}, 
		200
	);
})
.process(
	...multipartProcess({
		files: {
			avatar: {max: 1, mimeType: ["image/png"]},
			banners: {max: 3},
		}
	})
)
.handler(async({pickup}, response) => {
	const files = pickup("multipartGetFile");
	if(files.avatar.length === 0) response.code(400).info("missing avatar").send();
	else if(files.banners.length === 0) response.code(400).info("missing banners").send();

	const savingFiles: Promise<any>[] = [];
	files.avatar.forEach(file => savingFiles.push(file.save(__dirname + "/../storage/" + file.properties.filename)));
	files.banners.forEach(file => savingFiles.push(file.save(__dirname + "/../storage/" + file.properties.filename)));
	await Promise.all(savingFiles);

	parentPort?.postMessage("count files " + readdirSync(__dirname + "/../storage/").length);

	response.code(200).info("s").send();
});

duplo.launch(() => parentPort?.postMessage("ready"));
