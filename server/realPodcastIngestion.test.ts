import { describe, it, expect } from "vitest";
import { getPodcastStatus, PODCAST_CHANNELS } from "./realPodcastIngestion";

describe("Real Podcast Ingestion", () => {
  it("should have podcast channels defined", () => {
    expect(PODCAST_CHANNELS).toBeDefined();
    expect(Array.isArray(PODCAST_CHANNELS)).toBe(true);
    expect(PODCAST_CHANNELS.length).toBeGreaterThan(0);
  });

  it("should include All-In Podcast", () => {
    const names = PODCAST_CHANNELS.map((c: any) => c.name);
    expect(names.some((n: string) => n.toLowerCase().includes("all-in") || n.toLowerCase().includes("all in"))).toBe(true);
  });

  it("should have YouTube channel IDs for each podcast", () => {
    for (const channel of PODCAST_CHANNELS) {
      expect(channel).toHaveProperty("channelId");
      expect(typeof channel.channelId).toBe("string");
      expect(channel.channelId.length).toBeGreaterThan(0);
    }
  });

  it("should return a valid status object", async () => {
    const status = await getPodcastStatus();
    expect(status).toHaveProperty("totalChannels");
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("recentEpisodeCount");
    expect(typeof status.totalChannels).toBe("number");
    expect(status.totalChannels).toBe(PODCAST_CHANNELS.length);
  });
});
