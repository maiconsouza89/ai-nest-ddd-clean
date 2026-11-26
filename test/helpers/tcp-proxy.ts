import net from 'node:net';

/**
 * Proxy TCP em processo, numa porta livre, para derrubar um serviço e trazê-lo de volta no meio do teste.
 * O `close()` para de aceitar conexões e destrói as abertas (o cliente vê a queda na hora), e o `open()` volta a
 * escutar na mesma porta, então o cliente reconecta pelo mesmo endereço.
 *
 * Por que não o `restart()` do Testcontainers: ele pode trocar a porta mapeada do container, e o cliente, que
 * guarda o endereço antigo, não reconectaria. O `stop()` remove o container.
 */
export type TcpProxy = {
  readonly port: number;
  close(): Promise<void>;
  open(): Promise<void>;
};

export async function startTcpProxy(targetHost: string, targetPort: number): Promise<TcpProxy> {
  const sockets = new Set<net.Socket>();
  const track = (socket: net.Socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined).on('close', () => sockets.delete(socket));
  };
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, targetHost);
    track(client);
    track(upstream);
    client.pipe(upstream).pipe(client);
    // a queda de um lado derruba o outro
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
  });
  const listen = (port: number) =>
    new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });

  await listen(0);
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      }),
    open: () => listen(port),
  };
}
