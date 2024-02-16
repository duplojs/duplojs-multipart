# duplojs-multipart
[![NPM version](https://img.shields.io/npm/v/@duplojs/multipart)](https://www.npmjs.com/package/@duplojs/multipart)

## Instalation
```
npm i @duplojs/multipart
```

## Utilisation
```ts
import Duplo, {zod} from "@duplojs/duplojs";
import duploMultipart from "@duplojs/multipart";

const duplo = Duplo({port: 1506, host: "localhost", environment: "DEV"});

const multipartProcess = duplo.use(duploMultipart, {uploadFolder: "./upload"});

duplo.declareRoute("POST", "/upload")
.process(
    ...multipartProcess({
        files: {myFile: {max: 2}},
        fields: {test: zod.string().optional()},
    })
)
.handler(async({pickup}, response) => {
    const {test} = pickup("multipartGetFields")();
    console.log(test);
    pickup("multipartFile").myFile.forEach(value => value.save(value.properties.filename));
    response.code(200).send("ok !");
});

duplo.launch();
```