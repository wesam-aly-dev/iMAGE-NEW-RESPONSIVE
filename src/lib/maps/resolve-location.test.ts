import { describe, it, expect, vi } from "vitest";
import { resolveGoogleMapsLocation } from "./resolve-location";

describe("Google Maps URL Resolver & Normalizer", () => {
  it("resolves direct coordinate strings", async () => {
    const res = await resolveGoogleMapsLocation("30.0131, 31.4913");
    expect(res.success).toBe(true);
    expect(res.latitude).toBe(30.0131);
    expect(res.longitude).toBe(31.4913);
    expect(res.isEmbeddable).toBe(true);
    expect(res.embedUrl).toContain("30.0131,31.4913");
    expect(res.directionsUrl).toContain("destination=30.0131,31.4913");
  });

  it("resolves query coordinate URLs", async () => {
    const res = await resolveGoogleMapsLocation("https://maps.google.com/?q=30.0131,31.4913");
    expect(res.success).toBe(true);
    expect(res.latitude).toBe(30.0131);
    expect(res.longitude).toBe(31.4913);
    expect(res.embedUrl).toContain("output=embed");
    expect(res.directionsUrl).toContain("30.0131,31.4913");
  });

  it("resolves full place URLs with @lat,lng coordinates", async () => {
    const res = await resolveGoogleMapsLocation(
      "https://www.google.com/maps/place/American+University+in+Cairo/@30.0195,31.4995,16z/data=!4m6!3m5!1s0x145822f7a9!8m2!3d30.0195!4d31.4995"
    );
    expect(res.success).toBe(true);
    expect(res.latitude).toBe(30.0195);
    expect(res.longitude).toBe(31.4995);
    expect(res.placeName).toBe("American University in Cairo");
    expect(res.isEmbeddable).toBe(true);
    expect(res.directionsUrl).toContain("30.0195,31.4995");
  });

  it("extracts src from pasted <iframe> embed HTML snippets", async () => {
    const iframeCode = '<iframe src="https://maps.google.com/maps?q=30.0131,31.4913&output=embed" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>';
    const res = await resolveGoogleMapsLocation(iframeCode);
    expect(res.success).toBe(true);
    expect(res.isEmbeddable).toBe(true);
    expect(res.embedUrl).toBe("https://maps.google.com/maps?q=30.0131,31.4913&output=embed");
    expect(res.latitude).toBe(30.0131);
    expect(res.longitude).toBe(31.4913);
  });

  it("blocks SSRF attempts to private IP ranges and localhost", async () => {
    const localhostRes = await resolveGoogleMapsLocation("http://localhost:3000/maps");
    expect(localhostRes.success).toBe(false);
    expect(localhostRes.error).toContain("Unsupported host");

    const privateIpRes = await resolveGoogleMapsLocation("http://192.168.1.1/maps");
    expect(privateIpRes.success).toBe(false);
    expect(privateIpRes.error).toContain("Unsupported host");

    const metadataRes = await resolveGoogleMapsLocation("http://169.254.169.254/latest/meta-data");
    expect(metadataRes.success).toBe(false);
    expect(metadataRes.error).toContain("Unsupported host");
  });

  it("rejects non-Google hosts cleanly without throwing", async () => {
    const res = await resolveGoogleMapsLocation("https://attacker.com/fake-map");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unsupported host");
  });

  it("reports empty or whitespace inputs gracefully", async () => {
    const res = await resolveGoogleMapsLocation("   ");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Please enter a Google Maps URL");
  });

  it("resolves directions URLs with query destination coordinates", async () => {
    const res = await resolveGoogleMapsLocation("https://www.google.com/maps/dir/?api=1&destination=30.0131,31.4913");
    expect(res.success).toBe(true);
    expect(res.latitude).toBe(30.0131);
    expect(res.longitude).toBe(31.4913);
    expect(res.directionsUrl).toContain("destination=30.0131,31.4913");
  });

  it("resolves directions URLs with query destination place name", async () => {
    const res = await resolveGoogleMapsLocation("https://www.google.com/maps/dir/?api=1&destination=Aera+New+Cairo");
    expect(res.success).toBe(true);
    expect(res.placeName).toBe("Aera New Cairo");
    expect(res.embedUrl).toContain("Aera%20New%20Cairo");
  });

  it("extracts destination from path directions URLs instead of camera midpoint", async () => {
    const res = await resolveGoogleMapsLocation(
      "https://www.google.com/maps/dir/Cairo+Festival+City/American+University+in+Cairo/@30.0150,31.4000,14z/data=!4m2!4m1!3e0"
    );
    expect(res.success).toBe(true);
    expect(res.placeName).toBe("American University in Cairo");
    expect(res.directionsUrl).toContain("American%20University%20in%20Cairo");
  });

  it("resolves coordinates directly from path destination", async () => {
    const res = await resolveGoogleMapsLocation(
      "https://www.google.com/maps/dir//30.0131,31.4913/@30.0100,31.4800,15z"
    );
    expect(res.success).toBe(true);
    expect(res.latitude).toBe(30.0131);
    expect(res.longitude).toBe(31.4913);
  });

  it("detects and rejects multi-waypoint directions with clear guidance", async () => {
    const res = await resolveGoogleMapsLocation(
      "https://www.google.com/maps/dir/Stop1/Stop2/Stop3/Stop4/@30.0,31.4,12z"
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("multiple stops/waypoints");
  });

  it("supports valid negative coordinates (Southern/Western hemispheres)", async () => {
    const resSydney = await resolveGoogleMapsLocation("-33.8688, 151.2093");
    expect(resSydney.success).toBe(true);
    expect(resSydney.latitude).toBe(-33.8688);
    expect(resSydney.longitude).toBe(151.2093);

    const resNYC = await resolveGoogleMapsLocation("40.7128, -74.0060");
    expect(resNYC.success).toBe(true);
    expect(resNYC.latitude).toBe(40.7128);
    expect(resNYC.longitude).toBe(-74.0060);
  });
});

