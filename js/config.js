// js/config.js

const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
// Nota: Em produção real, evite expor a chave anon se possível, mas para este app client-side é o padrão.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

// Inicializa o cliente globalmente
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
