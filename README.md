<p align="center">
  <a href="https://nextjs.org">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dwmca4lse/image/upload/v1700745612/nmlcwzxjzqz47n3ggie4.png">
      <img src="https://res.cloudinary.com/dwmca4lse/image/upload/v1700745689/dmkxww0uuhgw7h4p6sc7.png" height="128">
    </picture>
  </a>
</p>

<p align="center">
A <strong>next.js</strong> api router that feels like <strong>experess.js</strong>
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
- [URL Params](#url-params)
- [Query Params](#query-params)
- [Body Parser](#body-parser)
- [Headers](#headers)
- [Cookies](#cookies)
- [Ejs](#ejs)
- [Error Hanlder](#error-hanlder)
- [Sub-Router](#sub-router)
  - [If Self-hosted](#if-self-hosted)
  - [If Deployed to Vercel](#if-deployed-to-vercel)
- [Sessions](#sessions)
  - [with `iron-session`](#with-iron-session)
  - [with `next-session`](#with-next-session)

## Note

- ⚠️ If you are deploying to Vercle, this might not be a good option since Vercle is a *Serverless Function* and `NextApiRouter` can become an overhead for every single api call. It will be more suitable if you are self-hosted. Otherwise, try not to have every route built in one single file (refer to [here](#sub-router))
- This is currently only compatabile with new `route api` introduced in `next13`
- If you are not familar with `express.js`, learn `express.js` first.

## Motivation

Next.js is awesome, however, using it to build backend api just is not intuitive and hard to manage if app size start to scale, especially it does not have a good support to middleware. Eventhough you can establish a custom server with `server.js` in next.js, the hustle you have to go through is not worthy and it is not beginner friendly as well. Therefore, this is built to levarage the concept of `express.js` by which making `next.js` backend api development easier.

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

- Refer to `express.js` for how this works, but the code example should be self explainatory.

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
app.get("/file", (req, res) => {
 const file = fs.createReadStream(process.cwd() + "/src/app/file.png");
 // pipe it
 res.pipe(file);
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
  // assume some one send /users?id=1
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

If you are deploying to Vercel, this is the way to go because Vercel will have problem copying your `.ejs` template after project built. So just stick to this approach to aviod all the hurdles.

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

## Error Hanlder

- the example show the default error handler. If route can't be found, the error object will be `NotFoundError` and if json body parser failed to parse the body, the error object `MalformedJsonError`
- if you override the default error handler, just ensure you cover all causes.

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
        return res.status(408).send("Request timeouot");
      }
      if (err instanceof MethodNotAllowedError) {
        return res.status(405).send("Method not allowed");
      }

      res
        .status(500)
        .send(
          process.env.NODE_ENV === "development" ? err.stack : "Server Error"
        );
})
```

## Sub-Router

Create sub router to allow you abascrat your routes into different files and create more complex routing.

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

if you are deploying to Vercel, this is strongly discouraged to create a sub router in the apporach shown above, instead, you can do following:

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

`next-session` will save data in either memoery or database.

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
