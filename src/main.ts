// A ordem é parte do contrato: o tracing registra o hook do import-in-the-middle e inicia o SDK, e
// só depois o app é carregado. Um `import` estático do app seria resolvido antes do hook, e as
// dependências que o código importa direto (como o `ioredis`) ficariam sem instrumentação.
import './tracing.js';
await import('./bootstrap.js');
