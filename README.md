# Buildless TypeScript webapps

Modern node can both [execute TypeScript files](https://nodejs.org/en/learn/typescript/run-natively) and [programmatically strip types from TypeScript files](https://nodejs.org/api/module.html#modulestriptypescripttypescode-options) which you are serving.

In combination, this means you can write your backend _and_ your frontend in TypeScript with no build steps and no additional dependencies, just by adding a few lines to your server, as long as you don't have dependencies in your frontend. Frontend dependencies can sometimes be made to work by adding an additional dependency; see below.

This repository serves as an example of one way to do this.

## Give me a code snippet

OK, here you go.

```ts
import { stripTypeScriptTypes } from 'node:module';

// ...

// update the logic for serving files as follows:
if (ext === '.ts') {
  const content = await fs.readFile(resolvedPath, 'utf8');
  res.type('text/javascript');
  res.send(stripTypeScriptTypes(content));
} else {
  res.sendFile(resolvedPath);
}
```

That's all you need to do.

## Details

Assuming you're on a reasonably modern node (24+), you shouldn't need to do anything to enable executing `.ts` files. Make sure to specify `"allowImportingTsExtensions": true` in your `tsconfig`, and refer to files by their full names (including the trailing `.ts` extension) everywhere, both in `import` statements and in `<script src="whatever.ts">` elements.

For the frontend, modify your server so that when serving a request for a `.ts` file the server will respond with `stripTypeScriptTypes(contents)` instead of serving `contents` directly, and explicitly set the `Content-Type` to `text/javascript` on the response. There's no need to mess with the extension because browsers use the `Content-Type` header to determine how to interpret files. `stripTypeScriptTypes` comes from the built-in `node:module` and is technically experimental, although it should be fairly stable. If you're using non-type features like `enum` you will need to specify `mode: 'transform'`; otherwise you can leave it at the default `mode: 'strip'`.

This is fast enough that you can safely do it on every request, if you were previously serving files from disk on every request. If you're doing some sort of caching of files in memory then be sure to cache the transformed file rather than the file from disk.

`stripTypeScriptTypes` supports generating source maps, but because it uses the trick from [ts-blank-space](https://github.com/bloomberg/ts-blank-space) of replacing types with whitespace characters it's not really necessary: column and line numbers after type stripping are the same as before.

## What about `node_modules`?

The technique above only works as long as your frontend does not have dependencies. To handle frontend dependencies, you need to insert an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) into your HTML files which hardcodes node's package resolution rules for all your dependencies. This works only if all your dependencies are ES modules; `require`, even in a transitive dependency, will not work. Also, it will break if anything imports a node-only package. So don't expect this to work reliably.

Anyway, the [`@jsenv/importmap-node-module`](https://www.npmjs.com/package/@jsenv/importmap-node-module) handles generating import maps for your projects, including reducing the resulting map to only those packages which are actually used. This can be done on the fly, though it takes a little time and so you might consider caching outputs.

You then need to rewrite all HTML files to insert the import map inline, as in

```js
if (ext === '.html') {
  const packageJsonDir = path.join(import.meta.dirname, '..');
  const relative = path.relative(packageJsonDir, resolvedPath);
  const importMap = JSON.stringify((await writeImportmaps({
    writeFiles: false,
    directoryUrl: packageJsonDir,
    importmaps: { [relative]: {} }, // default options are all fine
  }))[relative]);
  const content = await fs.readFile(resolvedPath, 'utf8');
  res.type('text/html');
  res.send(content.replace(/<script\b/i, `<script type="importmap">${importMap}</script><script`));
}
```

### Caveats

This will not work if you have [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) which need to make use of dependencies, and cannot be made to work until the web platform [gets support for import maps in workers](https://github.com/whatwg/html/pull/10858).

If you're getting an error about a script not providing some export, it is very likely that some dependency is using CommonJS style rather than ES module style.

## What about JSX?

Nope, sorry.

## What about Bun / Deno / whatever?

As of this writing those runtimes don't have `stripTypeScriptTypes` (possibly they have an equivalent; I haven't checked), but you can add a dependency on [amaro](https://www.npmjs.com/package/amaro) and then use its `transformSync` function - that's what node is using [under the hood](https://github.com/nodejs/node/blob/793a2792d5777cd59ec150e445196ffbabbc1421/lib/internal/modules/typescript.js#L47-L48) anyway.

## Is this really "buildless"?

Eh, depends on your definitions. As far as I'm concerned, the fact that you don't have to run a build command after making changes and can write your HTML to refer to your actual `.ts` files instead of some other directory means this counts.

## Should I do this in production?

Probably not, if "in production" entails significant scale - there's still a tiny bit of overhead, and if you're dealing with significant scale you should probably be bundling and minifying anyway.

This goes double if you're generating import maps, since the overhead on that is considerably larger than just type stripping. At the very least you should be caching your import maps rather than generating them on every request.

But other than the performance penalty I don't think there's anything wrong with this.

## Wasn't there a TC39 proposal for this?

There [is indeed such a proposal](https://github.com/tc39/proposal-type-annotations), though it hasn't made much progress lately. This is easier than waiting for that to ship, and unlike that proposal it supports all TypeScript syntax. And that proposal would have exactly the same issues with `node_modules` that this approach does.
