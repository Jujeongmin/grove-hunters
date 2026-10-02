async function later<T>(ms: number, run: () => Promise<T>): Promise<T> {
  const realNow = Date.now;
  Date.now = () => realNow() + ms;
  try {
    return await run();
  } finally {
    Date.now = realNow;
  }
}

async function onWorld(server: any, account: string, nickname: string, world: string): Promise<void> {
  server.connect({ account });
  await server.createCharacter(nickname, "warrior", "0000");
  await server.setWorld(world);
  await server.syncFriends();
}

describe("presence", () => {
  test("counts who is about on each server", async (server) => {
    await onWorld(server, "test-a", "Hunter", "w1");
    await onWorld(server, "test-b", "Seeker", "w1");
    await onWorld(server, "test-c", "Raider", "w3");
    expect(JSON.parse(JSON.stringify(await server.worldLoads()))).toEqual({ w1: 2, w3: 1 });
  });

  test("moving server moves the count, and the long gone drop out", async (server) => {
    await onWorld(server, "test-a", "Hunter", "w1");
    await onWorld(server, "test-b", "Seeker", "w2");
    server.connect({ account: "test-a" });
    await server.setWorld("w2");
    await server.syncFriends();
    expect(JSON.parse(JSON.stringify(await server.worldLoads()))).toEqual({ w2: 2 });
    const gone = await later(10 * 60_000, async () => {
      server.connect({ account: "test-b" });
      await server.syncFriends();
      return JSON.parse(JSON.stringify(await server.worldLoads()));
    });
    expect(gone).toEqual({ w2: 1 });
  });
});
