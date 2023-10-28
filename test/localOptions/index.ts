import {readFileSync, unlinkSync} from "fs";
import {workerTesting} from "@duplojs/worker-testing";

export default workerTesting(
	__dirname + "/route.ts",
	[
		{
			title: "field error",
			url: "http://localhost:1506/test/1",
			method: "POST",
			body: (() => {
				const formData = new FormData();
				formData.append("userId", "y");
				return formData;
			})(),
			output: [],
			response: {
				code: 400,
				info: "userId",
			}
		},
		{
			title: "error too large",
			url: "http://localhost:1506/test/1",
			method: "POST",
			body: (() => {
				const formData = new FormData();
				formData.append("userId", "22");
				return formData;
			})(),
			output: [],
			response: {
				code: 400,
				info: "big",
			}
		},
		{
			title: "error header",
			url: "http://localhost:1506/test/1",
			method: "POST",
			output: [],
			response: {
				code: 400,
				info: "bad header",
			}
		},
		{
			title: "error header",
			url: "http://localhost:1506/test/2",
			method: "POST",
			output: [
				"count files upload 1",
				"prefix true",
			],
			body: (() => {
				const formData = new FormData();
				const blob = new Blob([readFileSync(__dirname + "/../fakeFiles/1m.png")]);
				formData.append("avatar", new File([blob], "avatar.png", {type: "image/png", lastModified: Date.now()}));
				return formData;
			})(),
			response: {
				code: 200,
				info: "s",
			}
		},
	]
);
