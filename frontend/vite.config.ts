import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/app/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk - large external libraries
          vendor: ['react', 'react-dom'],
          
          // LangGraph SDK - separate chunk for LLM functionality  
          langgraph: ['@langchain/langgraph-sdk'],
          
          // UI components - separate chunk for reusable components
          ui: ['lucide-react', '@radix-ui/react-scroll-area', '@radix-ui/react-select'],
          
          // Services - API and business logic layer
          services: [
            './src/services/feedService.ts',
            './src/services/topicService.ts', 
            './src/services/chatService.ts'
          ]
        },
      },
    },
    // Performance optimizations  
    minify: true, // Use default esbuild minification instead of terser
    // Chunk size warnings
    chunkSizeWarningLimit: 400, // Warn if chunks exceed 400KB (our target)
  },
  server: {
    proxy: {
      // Proxy API requests to the backend server
      "/api": {
        target: "http://127.0.0.1:2024", // FastAPI backend address
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
