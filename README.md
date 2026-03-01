# JIOTV Proxy

A Vercel-based proxy for streaming DASH content with support for custom headers and DRM parameters.

## Features

- ✅ Deployed on Vercel with Germany (fra1) and Japan (hnd1) regions
- ✅ CORS support for video players
- ✅ Custom User-Agent handling
- ✅ DRM scheme and license parameter extraction
- ✅ DASH manifest rewriting for proper segment routing
- ✅ Range request support for partial content
- ✅ Automatic header forwarding (Origin, Referer, Accept-Language)

## Deployment

1. Fork this repository
2. Connect to Vercel
3. Deploy (no additional configuration needed)

## Usage

### Basic URL Format

```
https://your-deployment.vercel.app/api/proxy?url=<encoded-stream-url>
```

### Complex URL Format (with embedded parameters)

The proxy supports URLs with embedded parameters using the pipe (`|` or `%7C`) separator:

```
https://your-deployment.vercel.app/api/proxy?url=<manifest-url>%7CUser-Agent=<custom-ua>&drmScheme=<scheme>&drmLicense=<license>
```

### Example

```
https://your-deployment.vercel.app/api/proxy?url=https://live-d-01-icc-we.akamaized.net/variant/v1blackout/vcg-01-d/DASH_DASH/Live/channel(vcg-01-ch-hd-05)/hdntl=exp=1772398902~acl=%2fvariant%2fv1blackout%2fvcg-01-d%2f*~id=264bab4a-87da-4b7f-9e6a-9244b7304938~data=hdntl~hmac=691cc653b15cddfefa398c4604d27ff84efbafaca181a5ffaea37bc45ab16d55/manifest.mpd?%7CUser-Agent=Mozilla/5.0%20(Windows%20NT%2010.0;%20Win64;%20x64)%20AppleWebKit/537.36%20(KHTML,%20like%20Gecko)%20Chrome/145.0.0.0%20Safari/537.36&drmScheme=clearkey&drmLicense=d10e1f17d38833a698eff4de0e238bfa:3a4a0ce97d9fa2d86002c70205f6c40f
```

## How It Works

1. **Request Handling**: The proxy receives a request with a target URL
2. **Parameter Extraction**: Extracts User-Agent, DRM scheme, and license from URL parameters
3. **Upstream Fetch**: Fetches the content from the origin server with proper headers
4. **Manifest Rewriting**: For DASH manifests (.mpd), injects a `<BaseURL>` tag to route segments through the proxy
5. **Response Forwarding**: Returns the content with appropriate headers and CORS support

## Headers

The proxy automatically adds the following headers when fetching from upstream:

- `User-Agent`: Custom or default browser user agent
- `Accept`: */*
- `Accept-Language`: en-US,en;q=0.9
- `Origin`: https://jiocinema.com
- `Referer`: https://jiocinema.com/
- `Sec-Fetch-Dest`: empty
- `Sec-Fetch-Mode`: cors
- `Sec-Fetch-Site`: cross-site
- `Range`: Forwarded from client requests for partial content

## License

Apache License 2.0 - See LICENSE file for details
