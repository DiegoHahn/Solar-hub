"use client";

import { useState, useMemo, useRef } from "react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import {
  RiArrowUpCircleLine,
  RiArrowDownCircleLine,
  RiFileList3Line,
  RiSearchLine,
  RiCloseLine,
} from "@remixicon/react";
import type { ExtratoGdEntry } from "@/lib/types";

interface GdExtractListProps {
  entries: ExtratoGdEntry[];
}

type FilterType = "todos" | "injetada" | "compensada" | "gd1" | "gd2";

const PAGE_SIZE = 15;

export function GdExtractList({ entries }: GdExtractListProps) {
  const [filter, setFilter] = useState<FilterType>("todos");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filtragem dos lançamentos
  const filteredEntries = useMemo(() => {
    if (!entries) return [];

    return entries.filter((e) => {
      // Filtro de tipo
      if (filter === "injetada" && e.tipo !== "injetada") return false;
      if (filter === "compensada" && e.tipo !== "compensada") return false;
      if (filter === "gd1" && e.grupo !== 1) return false;
      if (filter === "gd2" && e.grupo !== 2) return false;

      // Filtro de busca (mês ou ano)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesMes = e.mes.toLowerCase().includes(q);
        const matchesTipo = (e.tipo === "injetada" ? "injetada" : "compensada").includes(q);
        if (!matchesMes && !matchesTipo) return false;
      }

      return true;
    });
  }, [entries, filter, search]);

  // Contagens para os botões de filtro
  const counts = useMemo(() => {
    if (!entries) return { todos: 0, injetada: 0, compensada: 0, gd1: 0, gd2: 0 };
    return {
      todos: entries.length,
      injetada: entries.filter((e) => e.tipo === "injetada").length,
      compensada: entries.filter((e) => e.tipo === "compensada").length,
      gd1: entries.filter((e) => e.grupo === 1).length,
      gd2: entries.filter((e) => e.grupo === 2).length,
    };
  }, [entries]);

  // Carregamento contínuo conforme o usuário rola o container interno
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 80) {
      if (visibleCount < filteredEntries.length) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredEntries.length));
      }
    }
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setVisibleCount(PAGE_SIZE);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setVisibleCount(PAGE_SIZE);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const visibleEntries = filteredEntries.slice(0, visibleCount);

  if (!entries || entries.length === 0) return null;

  return (
    <Card className="p-4 md:p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <RiFileList3Line className="size-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Extrato de Geração Distribuída
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Histórico completo de injeção e compensação de créditos · UC geradora
          </p>
        </div>

        <div className="text-xs text-gray-400 dark:text-gray-500 self-start sm:self-auto">
          Exibindo <span className="font-semibold text-gray-700 dark:text-gray-200">{visibleEntries.length}</span> de{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredEntries.length}</span> lançamentos
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="flex flex-col gap-2.5 pt-1">
        {/* Chips de filtro */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleFilterChange("todos")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "todos"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            Todos ({counts.todos})
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange("injetada")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "injetada"
                ? "bg-emerald-600 text-white dark:bg-emerald-500"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Injetada ({counts.injetada})
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange("compensada")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "compensada"
                ? "bg-gray-800 text-white dark:bg-gray-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <span className="size-1.5 rounded-full bg-blue-400" />
            Compensada ({counts.compensada})
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange("gd1")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "gd1"
                ? "bg-violet-600 text-white dark:bg-violet-500"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            GD I · Art. 26 ({counts.gd1})
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange("gd2")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "gd2"
                ? "bg-amber-600 text-white dark:bg-amber-500"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            GD II · Lei 14.300 ({counts.gd2})
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Filtrar por mês (ex: 08/2026 ou 2025)..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50/50 py-1.5 pl-8 pr-8 text-xs text-gray-900 placeholder-gray-400 outline-hidden transition-colors focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-100 dark:focus:border-blue-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <RiCloseLine className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* CONTAINER DE SCROLL INTERNO */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="max-h-[440px] overflow-y-auto pr-1 divide-y divide-gray-100 dark:divide-gray-900 rounded-lg border border-gray-100 dark:border-gray-900/60 p-2 [scrollbar-width:thin]"
      >
        {visibleEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">
            Nenhum lançamento encontrado para os filtros selecionados.
          </div>
        ) : (
          visibleEntries.map((e, idx) => {
            const isInjecao = e.tipo === "injetada";
            return (
              <div key={idx} className="flex items-center justify-between gap-3 py-2.5 px-2 hover:bg-gray-50/50 dark:hover:bg-gray-900/30 rounded-md transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isInjecao ? (
                    <RiArrowUpCircleLine className="size-5 shrink-0 text-emerald-500" />
                  ) : (
                    <RiArrowDownCircleLine className="size-5 shrink-0 text-blue-500 dark:text-blue-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {isInjecao ? "Energia injetada" : "Energia compensada"}
                    </p>
                    <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                      {e.mes}
                      <Badge variant="neutral" className="px-1 py-0 text-[10px]">
                        {e.grupo === 2 ? "GD II · Lei 14.300" : "GD I · Art. 26"}
                      </Badge>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={
                      isInjecao
                        ? "text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                        : "text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400"
                    }
                  >
                    {isInjecao ? "+" : ""}
                    {e.kwh.toLocaleString("pt-BR")} kWh
                  </p>
                  <p className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                    saldo {e.saldo.toLocaleString("pt-BR")} kWh
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Indicador de Carregamento Contínuo */}
        {visibleCount < filteredEntries.length && (
          <div className="py-3 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredEntries.length))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 py-1 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition-colors"
            >
              Carregar mais lançamentos (+{PAGE_SIZE})
            </button>
            <p className="mt-1 text-[10px] text-gray-400">
              Role para baixo para carregar automaticamente
            </p>
          </div>
        )}

        {visibleCount >= filteredEntries.length && filteredEntries.length > 0 && (
          <div className="py-2.5 text-center text-[11px] text-gray-400 dark:text-gray-500">
            ✓ Todos os {filteredEntries.length} lançamentos carregados
          </div>
        )}
      </div>
    </Card>
  );
}
