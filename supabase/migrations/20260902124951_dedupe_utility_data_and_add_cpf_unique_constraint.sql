-- Mantém só o registro mais recente por titular (CPF), removendo duplicatas de inserts antigos.
DELETE FROM public.utility_data a
USING public.utility_data b
WHERE a.cpf = b.cpf
  AND a.updated_at < b.updated_at;

-- Permite upsert por CPF: cada titular passa a ter uma única linha, sempre atualizada.
ALTER TABLE public.utility_data
  ADD CONSTRAINT utility_data_cpf_key UNIQUE (cpf);

COMMENT ON CONSTRAINT utility_data_cpf_key ON public.utility_data IS 'Garante uma linha por titular; usada como chave de upsert pelo collector_utility.py.';
