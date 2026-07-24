export default {
  async fetch(): Promise<Response> {
    return new Response("NamiVolt is running");
  },
} satisfies ExportedHandler;
