import {readFileSync, unlinkSync} from "fs";
import {workerTesting} from "@duplojs/worker-testing";

export default workerTesting(
	__dirname + "/route.ts",
	[
		{
			title: "test field",
			url: "http://localhost:1506/test/1",
			method: "POST",
			body: (() => {
				const formData = new FormData();
				formData.append("userId", "1");
				formData.append("username", "Mathieu");
				return formData;
			})(),
			output: [
				"userId 1",
				"username Mathieu"
			],
			response: {
				code: 200,
				info: "s",
			}
		},
		{
			title: "test field error",
			url: "http://localhost:1506/test/1",
			method: "POST",
			body: (() => {
				const formData = new FormData();
				formData.append("userId", "AAA");
				return formData;
			})(),
			response: {
				code: 400,
				info: "TYPE_ERROR.multipartProperties.userId",
			}
		},
		{
			title: "test field error",
			url: "http://localhost:1506/test/1",
			method: "POST",
			response: {
				code: 400,
				info: "Bad content-type",
			}
		},
		{
			title: "test file",
			url: "http://localhost:1506/test/2",
			method: "POST",
			body: (() => {
				const formData = new FormData();
				const blob = new Blob([readFileSync(__dirname + "/../fakeFiles/5m.png")]);
				formData.append("avatar", new File([blob], "avatar.png", {type: "image/png", lastModified: Date.now()}));
				formData.append("banners", new File([blob], "banner1.png", {type: "image/png", lastModified: Date.now()}));
				formData.append("banners", new File([blob], "banner2.png", {type: "image/png", lastModified: Date.now()}));
				formData.append("banners", new File([blob], "banner3.png", {type: "image/png", lastModified: Date.now()}));
				return formData;
			})(),
			output: [
				"count files 5",
				"count files upload 0"
			],
			sleepAfterRequest: 500,
			response: {
				code: 200,
				info: "s",
			},
			afterFunction: () => {
				unlinkSync(__dirname + "/../storage/avatar.png");
				unlinkSync(__dirname + "/../storage/banner1.png");
				unlinkSync(__dirname + "/../storage/banner2.png");
				unlinkSync(__dirname + "/../storage/banner3.png");
			}
		},
		{
			title: "test file",
			url: "http://localhost:1506/test/2",
			method: "POST",
			body: (() => {
				const formData = new FormData();
				const blob = new Blob([readFileSync(__dirname + "/../fakeFiles/5m.png")]);
				formData.append("avatar", new File([blob], "avatar.png", {type: "image/jpeg", lastModified: Date.now()}));
				formData.append("banners", new File([blob], "banner1.png", {type: "image/png", lastModified: Date.now()}));
				formData.append("banners", new File([blob], "banner2.png", {type: "image/png", lastModified: Date.now()}));
				formData.append("banners", new File([blob], "banner3.png", {type: "image/png", lastModified: Date.now()}));
				return formData;
			})(),
			output: ["count files upload 0"],
			sleepAfterRequest: 500,
			response: {
				code: 400,
				info: "missing avatar",
			},
		}, 
	]
);
