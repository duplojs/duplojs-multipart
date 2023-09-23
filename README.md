# duplojs-multipart

## Instalation
```
npm i @duplojs/multipart
```

## Utilisation
```ts
import Duplo, {zod} from "@duplojs/duplojs";
import duploMultipart from "../scripts/multipart";

const duplo = Duplo({port: 1506, host: "0.0.0.0"});

const multipartProcess = duplo.use(duploMultipart, {uploadFolder: "./upload"});

duplo.declareRoute("POST", "/upload")
.process(
    ...multipartProcess({
        files: {myFile: 2},
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