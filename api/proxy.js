export default async function handler(req, res) {
  // 1. Handle CORS for video players
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Get the target URL from the query string
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Please provide a stream URL in the ?url= parameter.');
  }

  try {
    // 3. Fetch the resource from the German/Japanese server
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream server responded with ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType || 'application/octet-stream');

    // 4. If it's the manifest file (.mpd), we must rewrite the base URLs
    // so the video chunks (.m4s) also get routed through this proxy.
    if (targetUrl.includes('.mpd') || (contentType && contentType.includes('dash+xml'))) {
      let manifestText = await response.text();
      
      // Extract the base path of the original URL
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      
      // Create the proxy prefix URL
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const proxyPrefix = `${protocol}://${host}/api/proxy?url=${encodeURIComponent(baseUrl)}`;

      // Inject a <BaseURL> tag into the DASH manifest so the player 
      // knows to request segments through our proxy
      const baseURLTag = `<BaseURL>${proxyPrefix}</BaseURL>\n`;
      manifestText = manifestText.replace(/<MPD[^>]*>/i, (match) => match + '\n  ' + baseURLTag);

      return res.status(200).send(manifestText);
    } 
    
    // 5. If it is a video segment (.m4s), just pipe the raw buffer through
    const buffer = await response.arrayBuffer();
    return res.status(200).send(Buffer.from(buffer));

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Failed to fetch the stream', details: error.message });
  }
}
