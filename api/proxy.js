export default async function handler(req, res) {
  // 1. Handle CORS for video players
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Get the target URL from the query string
  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Please provide a stream URL in the ?url= parameter.');
  }

  try {
    // Parse URL to extract embedded parameters like User-Agent, DRM, etc.
    const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
    let userAgent = DEFAULT_USER_AGENT;
    let drmScheme = null;
    let drmLicense = null;
    let cleanUrl = targetUrl;

    // Check for User-Agent in query parameters (from proxy-generated URLs)
    if (req.query['User-Agent']) {
      userAgent = req.query['User-Agent'];
    }

    // Check if URL contains pipe separator (|) for additional parameters
    if (targetUrl.includes('|') || targetUrl.includes('%7C')) {
      const urlParts = targetUrl.split(/\||\%7C/);
      cleanUrl = urlParts[0];
      
      // Parse the additional parameters after the pipe
      const paramsString = urlParts.slice(1).join('&');
      const additionalParams = new URLSearchParams(paramsString);
      
      if (additionalParams.has('User-Agent')) {
        userAgent = additionalParams.get('User-Agent');
      }
      if (additionalParams.has('drmScheme')) {
        drmScheme = additionalParams.get('drmScheme');
      }
      if (additionalParams.has('drmLicense')) {
        drmLicense = additionalParams.get('drmLicense');
      }
    }

    // 3. Fetch the resource from the German/Japanese server
    const fetchHeaders = {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://jiocinema.com',
      'Referer': 'https://jiocinema.com/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site'
    };

    // Handle Range header for partial content requests
    if (req.headers.range) {
      fetchHeaders['Range'] = req.headers.range;
    }

    const response = await fetch(cleanUrl, {
      method: 'GET',
      headers: fetchHeaders
    });

    if (!response.ok) {
      throw new Error(`Upstream server responded with ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType || 'application/octet-stream');

    // Copy important headers from upstream response
    if (response.headers.get('content-length')) {
      res.setHeader('Content-Length', response.headers.get('content-length'));
    }
    if (response.headers.get('content-range')) {
      res.setHeader('Content-Range', response.headers.get('content-range'));
    }
    if (response.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', response.headers.get('accept-ranges'));
    }

    // 4. If it's the manifest file (.mpd), we must rewrite the base URLs
    // so the video chunks (.m4s) also get routed through this proxy.
    if (cleanUrl.includes('.mpd') || (contentType && contentType.includes('dash+xml'))) {
      let manifestText = await response.text();
      
      // Extract the base path of the original URL (before any query params)
      const baseUrl = cleanUrl.split('?')[0].substring(0, cleanUrl.split('?')[0].lastIndexOf('/') + 1);
      
      // Create the proxy prefix URL with the original parameters preserved
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      
      // Build the proxy URL with all parameters preserved
      let proxyParams = `url=${encodeURIComponent(baseUrl)}`;
      if (userAgent !== DEFAULT_USER_AGENT) {
        proxyParams += `&User-Agent=${encodeURIComponent(userAgent)}`;
      }
      
      const proxyPrefix = `${protocol}://${host}/api/proxy?${proxyParams}`;

      // Inject a <BaseURL> tag into the DASH manifest so the player 
      // knows to request segments through our proxy
      const baseURLTag = `<BaseURL>${proxyPrefix}</BaseURL>\n`;
      manifestText = manifestText.replace(/<MPD[^>]*>/i, (match) => match + '\n  ' + baseURLTag);

      // If DRM info is present, add it to the manifest metadata as a comment
      if (drmScheme && drmLicense) {
        const drmComment = `<!-- DRM: ${drmScheme} | License: ${drmLicense} -->\n`;
        manifestText = drmComment + manifestText;
      }

      return res.status(200).send(manifestText);
    } 
    
    // 5. If it is a video segment (.m4s), just pipe the raw buffer through
    // Set appropriate status code for range requests
    if (response.status === 206) {
      res.status(206);
    }
    
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Failed to fetch the stream', details: error.message });
  }
}
