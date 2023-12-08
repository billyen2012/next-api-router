<p align="center">
  <a href="https://billyen2012.github.io/next-api-router-home-page" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dwmca4lse/image/upload/v1700745612/nmlcwzxjzqz47n3ggie4.png">
      <img src="https://res.cloudinary.com/dwmca4lse/image/upload/v1700745689/dmkxww0uuhgw7h4p6sc7.png" height="128">
    </picture>
  </a>
</p>

<p align="center">
A <strong>next.js</strong> api router that feels like <strong>express.js</strong>
</p>

<p align="center">
   <a href="https://billyen2012.github.io/next-api-router-home-page" target="_blank">Visit home page here</a> !
</p>

## [Home Page](https://billyen2012.github.io/next-api-router-home-page)

- Please use [home page](https://billyen2012.github.io/next-api-router-home-page) for all api references. It aslo has more info like how to setup Graphql, Swagger, supported express.js middlewares, etc.

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
import NextApiRouter from "@billyen2012/next-api-router";

const app = NextApiRouter({
  timeout: 20 * 1000,
  apiFolderPath: "/api", // '/api' will be the default
  ejsFolderPath: "/src/app/views", // need include all folder encounter from the route (there is no default value). No need to set this up if you are not using ejs
});

app.get("/hello", (req, res, next) => {
  res.send("Hello");
});

const handler = app.handler();
export const dynamic = "force-dynamic";
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

And then have your `const export app = NextApiRouter()` created in some other folder or file and then import them to both `route.js`

<hr/>

<h3 align="center">
   For more info, checkout the
   <a href="https://billyen2012.github.io/next-api-router-home-page" target="_blank">home page here</a> !
</h3>
