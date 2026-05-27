# Altera

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.


## V4VAPP API

The V4VAPP API is a RESTful API that provides access to the V4VAPP backend. It is used by the V4VAPP frontend to fetch data and perform actions such as generate deposit invoices.

The API is available at `https://api.v4v.app` in production, and `https://devapi.v4v.app` in development. You can also set the API base URL using the `V4VAPP_API_BASE` environment variable.

To use the development API, set the `PUBLIC_V4VAPP_API_MODE` environment variable to `dev` in your `.env` file:

```env
PUBLIC_V4VAPP_API_MODE=dev
```
