<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dwmca4lse/image/upload/v1700745612/nmlcwzxjzqz47n3ggie4.png">
    <img src="https://res.cloudinary.com/dwmca4lse/image/upload/v1700745689/dmkxww0uuhgw7h4p6sc7.png" height="128">
  </picture>
</p>

<p align="center">
A <strong>next.js</strong> api router that feels like <strong>express.js</strong>
</p>

## Table of contents

- [Table of contents](#table-of-contents)
- [Note](#note)
- [Motivation](#motivation)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [The Base Route Problem](#the-base-route-problem)
- [Middlewares](#middlewares)
- [Send a file](#send-a-file)
- [`writeHead(status, headers)`, `writeLine(msg)` and `end(msg)`](#writeheadstatus-headers-writelinemsg-and-endmsg)
- [URL Params](#url-params)
- [Query Params](#query-params)
- [Body Parser](#body-parser)
- [Headers](#headers)
- [Cookies](#cookies)
- [Ejs](#ejs)
- [Error Handler](#error-handler)
- [Global Try/Catch and Catch Async](#global-trycatch-and-catch-async)
- [Sub-Router](#sub-router)
  - [If Self-hosted](#if-self-hosted)
  - [If Deployed to Vercel](#if-deployed-to-vercel)
- [Sessions](#sessions)
  - [with `iron-session`](#with-iron-session)
  - [with `next-session`](#with-next-session)

## Note

- ⚠️ If you are deploying to Vercel, this might not be a good option since Vercel is a *Serverless Function* and `NextApiRouter` can become an overhead for every single api call. It will be more suitable if you are self-hosted. Otherwise, try not to have every route built in one single file (refer to [here](#sub-router))
- This is currently only compatible with new `route api` introduced in `next13`
- If you are not familiar with `express.js`, learn `express.js` first.

## Motivation

Next.js is awesome, however, using it to build backend api just is not intuitive and hard to manage if app size start to scale, especially it does not have a good support to middleware. Even though you can establish a custom server with `server.js` in next.js, the hustle you have to go through is not worthy and it is not beginner friendly as well. Therefore, this is built to leverage the concept of `express.js` by which making `next.js` backend api development easier.

## Installation

```context
npm i @billyen2012/next-api-router
```

or for yarn

```context
yarn add @billyen2012/next-api-router
```

## Quick Start

under the `/app` dir, create a folder structure as shown below

```text
app/
└── api/
    └── [...]/
        └── route.js
```

- The `[...]` means to catch all the the request. This is required since `NextApiRouter` will create a separete route table to match the request url.

Then in the `route.js`, add the following

```js
import NextApiRouter from "next-api-router";

const app = NextApiRouter({
  timeout: 20 * 1000,
  apiFolderPath: "/api", // '/api' will be the default
  ejsFolderPath: "/src/app/views", // need include all folder encounter from the route (there is no default value). No need to set this up if you are not using ejs
});


app.get("/hello", (req, res, next) => {
    res.send("Hello")
});

const handler = app.handler()
export const dynamic = 'force-dynamic'
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
```

## The Base Route Problem

The example shown in the quick start section will not process the base route such as `app.get("/")`. If you do need the base route to be open, you can do the following.

```text
app/
└── api/
    ├── [...]/
    │   └── route.js
    └── route.js
```

And then have you `const export app = NextApiRouter()` created in some other folder or file and then import them to both `route.js`

## Middlewares

- Refer to `express.js` for how this works, but the code example should be self explanatory.

```js

import NextApiRouter from "next-api-router";

const app = NextApiRouter();

app.use((req, res, next) => {
  //...
  console.log("1")
  next()
},(req, res, next) => {
  //...
  console.log("2")
  next()
});

app.get("/hello",(req, res, next) => {
  //...
  console.log("3")
  res.send()
  next()
},(req, res, next) => {
  console.log("4")
});

// and console will print 1,2,3,4

```

## Send a file

```js
import fs from "fs";
import NextApiRouter from "next-api-router";

// if file is a Readable
app.get("/file", async (req, res) => {
 const file = fs.createReadStream(process.cwd() + "/src/app/file.png");
 // pipe it
 await res.pipe(file);
});

// if file is a Buffer or a Readablestream
app.get("/file", (req, res) => {
 const file = fs.readFileSync(process.cwd() + "/src/app/file.png");
 // just send it
 res.send(file);
});

const app = NextApiRouter();

export const GET = app.handler();
```

## `writeHead(status, headers)`, `writeLine(msg)` and `end(msg)`

```js
const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
};

app.get("/writeline",
/**
 * This callback must not be an async proces.
 * Instead, put everything into a async function locally
 * and call it at the end (just see example below)
 **/
(req, res, next) => {
  res.writeHead(200, { "content-type": "text/html" });

  const run = async () => {
    res.writeLine("<h3>start</h3>");
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      res.writeLine(`<p>${i}</p>`);
    }

    res.end("<h3>end</h3>");
  };

  run()
    // must catch error, otherwise it may cause UnhandledPromiseRejection error
    .catch((err) => {
      /**
       *  do NOT do `catch(next)`, it may not work because as soon as you call res.writeLine() or res.writeHead(), a
       *  response has already being sent back the client, and the program will assume response was sent to the client
       *  without error, hence the global error handler will never be triggered.
       *  Instead, you should pass your error handler directly to here.
       */
      console.log(err);
    });
});
```

## URL Params

```js
app.get("/users/:userId/post/:postId", (req, res) => {
  const { userId, postId} = req.params;
  console.log({ userId, postId})
  res.json({ userId, postId})
});
```

## Query Params

```js
app.get("/users", (req, res) => {
  // assume someone send '/users?id=1'
  const { id } = req.query;
  res.send(id)
});
```

## Body Parser

- the parse data will be in the `req.data` because `next.js` req.body object is a getter which can not be mutated.

```js
app.use(app.bodyParser.json());

app.post("/users", (req, res) => {
  console.log(req.data);
  res.send(id)
});

```

## Headers

```js
app.get("/users", (req, res) => {
  // get headers
  req.getHeader("authorization");
  req.headers.get("authorization");
  req.getHeaders(["authorization"]);

  // set headers
  res.setHeader("Content-Type", 'image/png');
  res.headers.set("Content-Type", 'image/png');
  res.setHeaders({"content-type":"image/png"})
});
```

## Cookies

```js
app.get("/", async (req, res, next) => {
  // get cookie
  const { name, value } = req.cookies.get("locale") ?? {};
  // set cookie
  res.cookies.set("locale", "zh_tw", {
    path: "/",
    //...
  });
  res.send();
});
```


## Ejs

```js
import NextApiRouter from "next-api-router";

const app = NextApiRouter({ejsFolderPath:"/views"});

app.get("/", async (req, res, next) => {
  await res.render("/hello", { firstName: "Foo" });
});

```

Example of ejs

```js
<html>
  <head>
    <title>Example</title>
  </head>
  <body>
    <p><%=firstName%></p>
  </body>
</html>
```

You can also just directly pass ejs template to the `render()` method

If you are deploying to Vercel, this is the way to go because Vercel will have problem copying your `.ejs` template after project built. So just stick to this approach to avoid all the hurdles.

```js
app.get("/render", async (req, res, next) => {
  await res.render(
    `
  <html>
    <body>
      Hello World <%=foo%>
    </body>
  </html>
  `,
    { foo: "bar" }
  );
})
```

## Error Handler

- the example is the default error handler.
- if you override the default error handler, just ensure you cover all the cases.

```js
app.errorHandler((err, res, res)=>{
      // below is default error handler
      if (err instanceof NotFoundError) {
        return res.status(404).send("Not found");
      }
      if (err instanceof MalformedJsonError) {
        return res.status(400).send("Malformed json in body's payload");
      }
      if (err instanceof TimeoutError) {
        return res.status(408).send("Request timeout");
      }
      if (err instanceof MethodNotAllowedError) {
        return res.status(405).send("Method not allowed");
      }

      console.log(err);

      res
        .status(500)
        .send(
          process.env.NODE_ENV === "development" ? err.stack : "Server Error"
        );
})
```

## Global Try/Catch and Catch Async

To jump directly to the error handler from any point of your code, you can simply throw an error. This will be handy when doing input validation, authentication, etc.

```js
app.use((req,res, next)=>{
    if(!req.session.user){
       throw new Error("Not Authorized")
    }
    next()
});
```

If there is any `Promise`, make sure you `await` the promise, or it will cause the unhandled promise rejection.

```js
app.use(async (req,res, next)=>{
    await someAsyncProcess()
    next()
});

app.use(async (req,res, next)=>{
    // or you can do
    someAsyncProcess().catch(err=>{
      // usually you will want to have a custom error handler here, but this is just an example
      console.log(err)
    })
    next()
});
```

## Sub-Router

Create sub router to allow you separate your routes into different files and create more complex routing.

### If Self-hosted

```js
import NextApiRouter from "next-api-router";

const router = NextApiRouter()

router.get("/foo", (req,res)=>{
  res.send("bar")
})

export default router
```

And in app `route.js`

```js
import NextApiRouter from "next-api-router";
import router from '../the-router-you-just-added'

const app = NextApiRouter()

app.use("/subroute", router)

export default router
```

### If Deployed to Vercel

if you are deploying to Vercel, this is recommended to use the following approach.

```text
app/
└── api/
    ├── [...]/
    │   └── route.js
    └── admin/
        └── [...]/
            └── route.js
```

```js

/** in app/api/[...]/route.js */
import NextApiRouter from "next-api-router";

const app = NextApiRouter({apiFolderPath:"/api"});

export const GET = app.handler();
/** ************************ */

/** in app/api/admin/[...]/route.js */
import NextApiRouter from "next-api-router";

const app = NextApiRouter({apiFolderPath:"/api/admin"});

export const GET = app.handler();
/** ************************ */
```

## Sessions

NextApiRouter is integration ready with [next-session](https://www.npmjs.com/package/next-session) and [iron-session](https://www.npmjs.com/package/iron-session)

### with `iron-session`

`irons-session` will save data info directly in the encrypted session id, so no additional database or cache is required.

```js
// example reference from https://github.com/hoangvvo/next-session#readme
/** for example only, you should put this part in a separate file and import it  */
import { getIronSession } from "iron-session";
/** ************ */

const app = NextApiRouter({ timeout: 3000 });

app.use(async (req, res, next) => {
  const session = await getIronSession(
    // pass cookies object from res because the one in req in immutable
    res.cookies,
    {
      password: "your_encryption_secret_that_is_at_least_32_characters_long",
      cookieName: "next_sid",
    }
  );
  // set session to req.session
  req.session = session;
  next();
});

app.get("/", async (req, res) => {
  req.session.views = req.session.views ? req.session.views + 1 : 1;
  res.send(
    `In this session, you have visited this website ${req.session.views} time(s).`
  );
  // make sure you save the change at the end
  await req.session.save();
});

export const GET = app.handler();
```

### with `next-session`

`next-session` will save data in either memory or database.

```js
// example reference from https://github.com/hoangvvo/next-session#readme
import NextApiRouter from "next-api-router";
/** for example only, you should put this part in a separate file and import it  */
import nextSession from "next-session";
// set autoCommit to false, autoCommit does not work, so you will have to commit change manually
const getSession = nextSession({ autoCommit: false });
/** ************ */

const app = NextApiRouter({ timeout: 3000 });

app.use(async (req, res, next) => {
  const session = await getSession(
    // create an object that can be accept by the nextSession
    {
      headers: {
        cookie: req.cookies.toString(),
      },
    },
    res
  );
  // set session to req.session
  req.session = session;
  next();
});

app.get("/", async (req, res) => {
  req.session.views = req.session.views ? req.session.views + 1 : 1;
  res.send(
    `In this session, you have visited this website ${req.session.views} time(s).`
  );
  // must 'await', otherwise if it failed, it will turn into unhandledPromiseRejection
  await req.session.commit();
});

export const GET = app.handler();
```
