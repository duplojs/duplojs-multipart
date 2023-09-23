import Duplo, {zod} from "@duplojs/duplojs";
import duploMultipart from "../scripts/multipart";

const duplo = Duplo({port: 1506, host: "0.0.0.0"});

const multipartProcess = duplo.use(duploMultipart);

duplo.declareRoute("GET", "/")
.handler(({}, response) => {
	response.code(200).setHeader("content-type", "text/html").send(/* html */`
		<form action="/upload" method="post" enctype="multipart/form-data">
			<input type="text" name="test">
			<input type="file" name="myFile" multiple>
			<input type="submit" value="Submit">
		</form>
	`);
});

duplo.declareRoute("POST", "/upload")
.process(
	...multipartProcess({
		files: {myFile: 2},
		fields: {test: zod.string().optional()},
	})
)
.handler(async({pickup}, response) => {
	// await new Promise((resolve) => setTimeout(resolve, 5000));
	const {test} = pickup("multipartGetFields")();
	console.log(test);
	pickup("multipartFile").myFile.forEach(value => value.save(value.properties.filename));
	response.code(200).send("ok !");
});

duplo.launch();
