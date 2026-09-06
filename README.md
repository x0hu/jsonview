# JSONView

[JSONView](http://jsonview.com) is a Web extension compatible with Firefox and Google Chrome that helps you view JSON documents in the browser.

- [Install for Firefox](https://addons.mozilla.org/en-US/firefox/addon/jsonview/)
- [Install for Chrome](https://chrome.google.com/webstore/detail/jsonview/gmegofmjomhknnokphhckolhcffdaihd)
- [Install for Edge](https://microsoftedge.microsoft.com/addons/detail/jsonview/kmpfgkgaimakokfhgdahhiaaiidiphco)
- There is no version for Safari because it costs $100/year to publish a free extension to the Mac App Store.

Normally, when encountering a [JSON](http://json.org) document (content type `application/json`), Firefox simply prompts you to download the view. With the JSONView extension, JSON documents are shown in the browser similar to how XML documents are shown. The document is formatted, highlighted, and arrays and objects can be collapsed. Even if the JSON document contains errors, JSONView will still show the raw text.

Once you've got JSONView installed, check out [this example JSON file](http://jsonview.com/example.json) to see the extension in action!

If you'd like to contribute to JSONView but don't want to code, consider contributing a translation. Copy the existing localization files from `src/_locale` and fill them in for your own language, then send a pull request. You can do it all from the GitHub interface. There are not many strings to translate!

## IPFS links

Clicking an IPFS gateway link opens JSONView's extension viewer and requests the same CID and path from `ipfs.io`, `gateway.pinata.cloud`, and `gateway.ipfs.io` concurrently. The first complete, successful JSON response wins; the other requests are cancelled. Image, audio, and video links open as soon as a gateway returns successful media headers, without waiting for the other gateways. Errors and HTML gateway loading pages cannot win the race. If no gateway returns usable content within five seconds, the viewer opens the original link normally, unless a browser check was detected. For browser checks, the viewer stays open and offers verification links that open the challenged gateways in new tabs. Complete the check yourself, then select Retry after verification. No popup opens automatically. Open original is also available immediately. Gateway requests reuse existing browser cookies, and the loading screen reports browser checks and gateway errors. Interactive checks and service-worker gateway pages must run through normal navigation.

Directly opened IPFS pages also support JSON embedded in a gateway's HTML wrapper, including content inserted after loading. The extension bundles its stylesheet and applies it synchronously before showing formatted JSON. JSON already available on an IPFS page does not wait for a background-worker response. The extension viewer shows the original public URL with a Copy URL button.

## Keyboard Shortcuts

- Left Arrow - Collapses the json on key up
- Right Arrow - Expands the json on key up

## Reporting Issues

Use the GitHub [Issue tracker for JSONView](https://github.com/bhollis/jsonview/issues) to file issues. Pull requests are especially welcome.

## Developing JSONView

Before contributing to JSONView, make sure to read the [Contributing Guidelines](CONTRIBUTING.md). I appreciate contributions people make to JSONView, but the goal of the extension is to be simple and straightforward, so I frequently reject contributions that add complexity or unnecessary features. Please consider filing an issue before doing any work, so you don't waste time on something I won't accept.

- Install [NodeJS](https://nodejs.org/en/) 20 or newer.
- Check out jsonview.
- Run `npm install` inside the jsonview repository.
- Run `npm start` to build the extension. This works in Windows Command Prompt, PowerShell, macOS, and Linux without Bash or a separate ZIP tool.
- The build creates `build-chrome`, `build-firefox`, and both ZIP packages. If you prefer pnpm, run `corepack enable`, `pnpm install`, and `pnpm start`.
- Run `npm run watch` to rebuild both browser extensions automatically whenever source files, styles, HTML, manifests, translations, icons, or build configuration change. Keep the watcher running while developing. Reload the extension in your browser and refresh open pages to load the rebuilt files.
- In Firefox, go to `about:debugging#addons` in the address bar, check "Enable add-on debugging", select "Load Temporary Add-on", and choose the `jsonview/build-firefox/manifest.json` file.
- In Chrome, Edge, etc., go to `edge://extensions/`, in the address bar, enable "Developer mode", select "Load Unpacked", and choose the `jsonview/build-chrome` folder.
- Run `pnpm tests` to start a little webserver that serves all the JSON files in `./tests`.

JSONView makes use of [TypeScript](https://www.typescriptlang.org/). I recommend [VSCode](https://code.visualstudio.com/) for editing the code - it will automatically prompt to install the correct extensions, and will highlight errors. All of the code that makes up the extension itself are in `src/`.

## Common Issues

- **JSONView isn't displaying my file as JSON**: You are probably not serving
  the JSON with the "application/json" MIME type.
- **Opening a local .json file uses the Firefox default JSON viewer**: You need to disable the built-in JSON viewer to use JSONView. Go to "about:config" and set "devtools.jsonview.enabled" to "false".

JSONView is open source software under the MIT license.

## Publishing

```
pnpm start
```

`jsonview-chrome.zip` and `jsonview-firefox.zip` can then be manually uploaded to the extension sites.

- Chrome: https://chrome.google.com/webstore/devconsole/
- Firefox: https://addons.mozilla.org/en-US/developers/addons
- Edge: https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview

### Your own IPFS gateway

Click the JSONView extension icon to open settings. Enter your HTTPS gateway base URL and select Save gateway. A trailing `/ipfs` is optional. Do not paste a content CID, query token, or username/password. The saved gateway joins the three public gateways on the next request, including nested links and retries. Remove clears the setting.

Settings stay in this browser’s local extension storage and are not synced or bundled in releases. Local storage is not an encrypted secret vault. Revoke any exposed endpoint through your gateway provider before replacing it.
