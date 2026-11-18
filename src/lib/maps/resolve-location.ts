/**
 * Google Maps URL Resolver & Normalizer
 *
 * Securely parses and normalizes Google Maps URLs, coordinates, short links,
 * and embed targets for Image Developments project location sections.
 *
 * Features SSRF protection, strict Google-only host validation, redirect bounding,
 * and canonical embed & directions URL synthesis.
 */

export interface ResolvedLocation {
  success: boolean;
  latitude?: number;
  longitude?: number;
  placeName?: string;
  embedUrl: string;
  directionsUrl: string;
  originalUrl: string;
  isEmbeddable: boolean;
  error?: string;
  warning?: string;
}

// Strictly allow-listed hostnames for Google Maps redirects and embeds
const ALLOWED_GOOGLE_HOSTS = new Set([
  "maps.google.com",
  "www.google.com",
  "google.com",
  "maps.app.goo.gl",
  "goo.gl",
  "google.com.eg",
]);

function isAllowedGoogleHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (ALLOWED_GOOGLE_HOSTS.has(lower)) return true;
  // Match *.google.com or google.[country]
  if (lower.endsWith(".google.com") || lower.endsWith(".google.com.eg")) return true;
  return false;
}

function isPrivateIpOrHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }

  // IPv4 Private & Link-Local Ranges
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Cloud Metadata / Link-Local)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
  }

  return false;
}

function extractCoordinatesFromString(text: string): { lat: number; lng: number } | null {
  // Pattern 1: Raw coordinates like "30.0131, 31.4913" or "-33.8688, 151.2093"
  const rawMatch = text.match(/^([-+]?[0-9]{1,2}(?:\.[0-9]+)?)[,\s]+([-+]?[0-9]{1,3}(?:\.[0-9]+)?)$/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Pattern 2: /@lat,lng or q=lat,lng or ll=lat,lng or query=lat,lng or destination=lat,lng or daddr=lat,lng
  const urlCoordMatch = text.match(/(?:@|[?&](?:q|ll|query|center|destination|daddr|loc:)=)([-+]?[0-9]{1,2}\.[0-9]{3,})[,\s+]([-+]?[0-9]{1,3}\.[0-9]{3,})/i);
  if (urlCoordMatch) {
    const lat = parseFloat(urlCoordMatch[1]);
    const lng = parseFloat(urlCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Pattern 3: !3dlat!4dlng in pb parameter
  const pbMatch = text.match(/!3d([-+]?[0-9]{1,2}\.[0-9]+)!4d([-+]?[0-9]{1,3}\.[0-9]+)/);
  if (pbMatch) {
    const lat = parseFloat(pbMatch[1]);
    const lng = parseFloat(pbMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

interface DirectionsDestinationResult {
  isDirections: boolean;
  hasMultipleWaypoints?: boolean;
  coordinates?: { lat: number; lng: number };
  placeName?: string;
  error?: string;
}

/**
 * Parses Google Maps Directions URLs (/maps/dir/ or ?daddr= or ?destination=)
 * to safely extract the destination, ignoring origin and camera center.
 * Rejects ambiguous multi-stop waypoints with clear user guidance.
 */
function parseDirectionsDestination(urlStr: string): DirectionsDestinationResult | null {
  try {
    const u = new URL(urlStr);
    const isDir = u.pathname.includes("/maps/dir") || u.pathname.startsWith("/dir") || u.searchParams.has("daddr") || (u.pathname.includes("/maps") && u.searchParams.has("destination"));
    if (!isDir) return null;

    // Check for explicit waypoints in query parameters
    const waypointsParam = u.searchParams.get("waypoints");
    if (waypointsParam && (waypointsParam.includes("|") || waypointsParam.includes("%7C") || waypointsParam.trim().length > 0)) {
      return {
        isDirections: true,
        hasMultipleWaypoints: true,
        error: "This directions URL contains multiple stops/waypoints. Please provide a Google Maps place link or coordinates for the destination.",
      };
    }

    // Check query params: destination or daddr
    const queryDest = u.searchParams.get("destination") || u.searchParams.get("daddr");
    if (queryDest) {
      const decoded = decodeURIComponent(queryDest.replace(/\+/g, " ")).trim();
      const coords = extractCoordinatesFromString(decoded);
      if (coords) {
        return { isDirections: true, coordinates: coords };
      }
      if (decoded && !/^[0-9.,+-]+$/.test(decoded)) {
        return { isDirections: true, placeName: decoded };
      }
    }

    // Parse path segments in /maps/dir/...
    const dirIdx = u.pathname.indexOf("/dir");
    if (dirIdx !== -1) {
      const afterDir = u.pathname.slice(dirIdx + 4);
      // Split by slash and decode
      const rawSegments = afterDir.split("/").map((s) => s.trim());
      // Filter out camera params (@lat,lng), metadata (data=, am=), and empty trailing segments
      const routeSegments: string[] = [];
      for (const seg of rawSegments) {
        if (!seg) continue;
        if (seg.startsWith("@")) break; // Reached camera viewport parameters
        if (seg.startsWith("data=")) break; // Reached protobuf parameters
        if (seg.startsWith("am=")) break;
        routeSegments.push(decodeURIComponent(seg.replace(/\+/g, " ")).trim());
      }

      // If more than 2 stops (e.g. Origin, Waypoint1, Destination), this is a multi-waypoint route
      if (routeSegments.length > 2) {
        return {
          isDirections: true,
          hasMultipleWaypoints: true,
          error: `This directions URL contains multiple stops/waypoints (${routeSegments.length} stops detected). Please provide a direct place link or coordinates for the final destination.`,
        };
      }

      if (routeSegments.length > 0) {
        // In 1-stop (/dir//Dest or /dir/Dest) or 2-stop (/dir/Origin/Dest), the last segment is the destination
        const destSegment = routeSegments[routeSegments.length - 1];
        if (destSegment) {
          const coords = extractCoordinatesFromString(destSegment);
          if (coords) {
            return { isDirections: true, coordinates: coords };
          }
          if (!/^[0-9.,+-]+$/.test(destSegment)) {
            return { isDirections: true, placeName: destSegment };
          }
        }
      }
    }

    // If directions URL was identified but destination is missing or ambiguous
    return {
      isDirections: true,
      error: "Could not identify the destination from this directions URL. Please provide a Google Maps place link or coordinates directly to the destination.",
    };
  } catch {
    return null;
  }
}

function extractPlaceName(urlStr: string): string | undefined {
  try {
    const u = new URL(urlStr);
    // Path place format: /maps/place/Place+Name/...
    const placeMatch = u.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch && placeMatch[1]) {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
      if (decoded && !/^[0-9.,+-]+$/.test(decoded)) {
        return decoded;
      }
    }

    // Query parameter q or query:
    const q = u.searchParams.get("q") || u.searchParams.get("query");
    if (q) {
      const decoded = decodeURIComponent(q.replace(/\+/g, " ")).trim();
      if (decoded && !/^[0-9.,+-]+$/.test(decoded)) {
        return decoded;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return undefined;
}

/**
 * Safely resolves short share links (e.g. maps.app.goo.gl or goo.gl/maps)
 * by following HTTP redirects with strict timeout, redirect count, and SSRF filtering.
 */
async function expandGoogleShortLink(initialUrl: string): Promise<string> {
  let currentUrl = initialUrl;
  let redirectsRemaining = 3;

  while (redirectsRemaining > 0) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      break;
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Invalid URL protocol. Only HTTPS Google Maps links are supported.");
    }

    if (isPrivateIpOrHost(parsedUrl.hostname) || !isAllowedGoogleHost(parsedUrl.hostname)) {
      throw new Error(`Untrusted destination host (${parsedUrl.hostname}). Only Google Maps domains are supported.`);
    }

    // If it's already an expanded maps.google.com or www.google.com/maps URL, stop
    if (
      (parsedUrl.hostname.includes("google.") && parsedUrl.pathname.includes("/maps")) ||
      parsedUrl.searchParams.has("q")
    ) {
      return currentUrl;
    }

    // Follow redirect
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      clearTimeout(timeoutId);

      const locationHeader = response.headers.get("location");
      if (locationHeader) {
        const nextUrl = new URL(locationHeader, currentUrl).toString();
        currentUrl = nextUrl;
        redirectsRemaining--;
        continue;
      }

      // If no Location header on HEAD, try a light GET to read meta refresh or canonical
      if (response.status >= 200 && response.status < 400) {
        return currentUrl;
      }

      break;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      // If HEAD failed, return what we have
      break;
    }
  }

  return currentUrl;
}

/**
 * Resolves an arbitrary Google Maps URL, iframe snippet, or coordinate pair.
 */
export async function resolveGoogleMapsLocation(rawInput: string): Promise<ResolvedLocation> {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      success: false,
      embedUrl: "",
      directionsUrl: "",
      originalUrl: "",
      isEmbeddable: false,
      error: "Please enter a Google Maps URL, embed code, or coordinates.",
    };
  }

  // 1. Check if user pasted an entire <iframe> embed code snippet
  let cleanInput = trimmed;
  if (cleanInput.includes("<iframe") && cleanInput.includes("src=")) {
    const srcMatch = cleanInput.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      cleanInput = srcMatch[1].trim();
    }
  }

  // 2. Direct coordinate pair: "30.0131, 31.4913"
  const directCoords = extractCoordinatesFromString(cleanInput);
  if (directCoords && !cleanInput.startsWith("http")) {
    const embedUrl = `https://maps.google.com/maps?q=${directCoords.lat},${directCoords.lng}&z=15&output=embed`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${directCoords.lat},${directCoords.lng}`;
    return {
      success: true,
      latitude: directCoords.lat,
      longitude: directCoords.lng,
      embedUrl,
      directionsUrl,
      originalUrl: cleanInput,
      isEmbeddable: true,
    };
  }

  // 3. Parse URL and validate host
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(cleanInput.startsWith("//") ? `https:${cleanInput}` : cleanInput);
  } catch {
    return {
      success: false,
      embedUrl: "",
      directionsUrl: "",
      originalUrl: cleanInput,
      isEmbeddable: false,
      error: "Invalid URL structure. Please paste a valid Google Maps link.",
    };
  }

  if (isPrivateIpOrHost(parsedUrl.hostname) || !isAllowedGoogleHost(parsedUrl.hostname)) {
    return {
      success: false,
      embedUrl: "",
      directionsUrl: "",
      originalUrl: cleanInput,
      isEmbeddable: false,
      error: `Unsupported host (${parsedUrl.hostname}). Supported hosts are maps.google.com, google.com/maps, and maps.app.goo.gl.`,
    };
  }

  // 4. Handle short links by following safe redirects
  let expandedUrl = cleanInput;
  if (parsedUrl.hostname === "maps.app.goo.gl" || parsedUrl.hostname === "goo.gl") {
    try {
      expandedUrl = await expandGoogleShortLink(cleanInput);
    } catch (err: unknown) {
      return {
        success: false,
        embedUrl: "",
        directionsUrl: cleanInput,
        originalUrl: cleanInput,
        isEmbeddable: false,
        error: err instanceof Error ? err.message : "Failed to expand Google Maps short link.",
      };
    }
  }

  // 5. If it's already an authorized embed URL (e.g. google.com/maps/embed?pb=...)
  if (expandedUrl.includes("/maps/embed") || expandedUrl.includes("output=embed")) {
    const coords = extractCoordinatesFromString(expandedUrl);
    const placeName = extractPlaceName(expandedUrl);
    const destParam = coords ? `${coords.lat},${coords.lng}` : placeName || "";
    const directionsUrl = destParam
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destParam)}`
      : expandedUrl;

    return {
      success: true,
      latitude: coords?.lat,
      longitude: coords?.lng,
      placeName,
      embedUrl: expandedUrl,
      directionsUrl,
      originalUrl: cleanInput,
      isEmbeddable: true,
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // 6. Handle Google Maps Directions URLs (/maps/dir/ or ?destination= or ?daddr=)
  const directionsResult = parseDirectionsDestination(expandedUrl);
  if (directionsResult && directionsResult.isDirections) {
    if (directionsResult.error) {
      return {
        success: false,
        embedUrl: "",
        directionsUrl: expandedUrl,
        originalUrl: cleanInput,
        isEmbeddable: false,
        error: directionsResult.error,
      };
    }

    if (directionsResult.coordinates) {
      const { lat, lng } = directionsResult.coordinates;
      let embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
      if (apiKey) {
        embedUrl = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${lat},${lng}`;
      }
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      return {
        success: true,
        latitude: lat,
        longitude: lng,
        embedUrl,
        directionsUrl,
        originalUrl: cleanInput,
        isEmbeddable: true,
      };
    }

    if (directionsResult.placeName) {
      const placeName = directionsResult.placeName;
      let embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&z=15&output=embed`;
      if (apiKey) {
        embedUrl = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(placeName)}`;
      }
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(placeName)}`;
      return {
        success: true,
        placeName,
        embedUrl,
        directionsUrl,
        originalUrl: cleanInput,
        isEmbeddable: true,
      };
    }
  }

  // 7. Extract coordinates and place from the expanded Google Maps URL
  const coords = extractCoordinatesFromString(expandedUrl);
  const placeName = extractPlaceName(expandedUrl);

  if (coords) {
    let embedUrl = `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`;
    if (apiKey) {
      embedUrl = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${coords.lat},${coords.lng}`;
    }
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;

    return {
      success: true,
      latitude: coords.lat,
      longitude: coords.lng,
      placeName,
      embedUrl,
      directionsUrl,
      originalUrl: cleanInput,
      isEmbeddable: true,
    };
  }

  if (placeName) {
    let embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&z=15&output=embed`;
    if (apiKey) {
      embedUrl = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(placeName)}`;
    }
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(placeName)}`;

    return {
      success: true,
      placeName,
      embedUrl,
      directionsUrl,
      originalUrl: cleanInput,
      isEmbeddable: true,
      warning: "Coordinates were not explicit in the link; using place name for embed.",
    };
  }

  // If link is from google.com/maps but coordinates or place couldn't be extracted unambiguously:
  return {
    success: false,
    embedUrl: "",
    directionsUrl: expandedUrl,
    originalUrl: cleanInput,
    isEmbeddable: false,
    error: "Could not unambiguously detect coordinates or place name from this Google Maps link. Please provide coordinates (e.g. 30.0131, 31.4913) or a full place share link.",
  };
}

