"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Tag,
  Sliders,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import type { RequisitoMinimo } from "@/lib/domain/types";
import { HelpTooltip } from "@/components/HelpTooltip";

interface RequirementsReviewPanelProps {
  termosBusca: string[];
  onChangeTermosBusca: (termos: string[]) => void;
  requisitos: RequisitoMinimo[];
  onChangeRequisitos: (reqs: RequisitoMinimo[]) => void;
  onReextractFromText: () => void;
}

const OPERADORES = [">=", "<=", "=", "contém", "compatível", ">", "<"];

export function RequirementsReviewPanel({
  termosBusca,
  onChangeTermosBusca,
  requisitos,
  onChangeRequisitos,
  onReextractFromText,
}: RequirementsReviewPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [novoTermo, setNovoTermo] = useState("");

  const handleAddTermo = () => {
    const clean = novoTermo.trim();
    if (!clean) return;
    if (!termosBusca.includes(clean)) {
      onChangeTermosBusca([...termosBusca, clean]);
    }
    setNovoTermo("");
  };

  const handleRemoveTermo = (idx: number) => {
    onChangeTermosBusca(termosBusca.filter((_, i) => i !== idx));
  };

  const handleAddRequisito = () => {
    onChangeRequisitos([
      ...requisitos,
      {
        Atributo: "Termo essencial",
        Operador: "contém",
        Valor: "",
        Unidade: "-",
        Obrigatorio: true,
      },
    ]);
  };

  const handleUpdateRequisito = (
    idx: number,
    patch: Partial<RequisitoMinimo>
  ) => {
    const next = requisitos.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChangeRequisitos(next);
  };

  const handleRemoveRequisito = (idx: number) => {
    onChangeRequisitos(requisitos.filter((_, i) => i !== idx));
  };

  return (
    <section
      aria-label="Revisão de Termos e Requisitos Mínimos"
      className="glass-panel rounded-2xl p-5 mb-6 border border-[#1B365D]/20 dark:border-[#B59410]/30"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF37]" />
          <h3 className="font-heading text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Estúdio de Termos de Busca & Requisitos Mínimos (Classificação A, B, C)
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {termosBusca.length} termo(s) • {requisitos.length} requisito(s)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReextractFromText}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800"
            title="Reextrair termos e requisitos a partir do texto do objeto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reextrair</span>
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column: Search Terms */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#B59410]" />
                <span>Termos de Busca Consultados no PNCP</span>
                <HelpTooltip
                  title="Filtro: Termos de Busca no PNCP"
                  summary="Palavras-chave enviadas à API de busca do PNCP para localizar Atas relacionadas ao seu objeto."
                  options={[
                    {
                      label: "Múltiplos termos",
                      description:
                        "O sistema consulta cada termo e unifica as atas sem duplicidade.",
                    },
                    {
                      label: "Edição livre",
                      description:
                        "Você pode remover termos genéricos clicando no '×' ou adicionar sinônimos específicos.",
                    },
                  ]}
                />
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {termosBusca.map((termo, idx) => (
                  <span
                    key={`${termo}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[#1B365D] text-white dark:bg-[#244472]"
                  >
                    <span>{termo}</span>
                    {termosBusca.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTermo(idx)}
                        className="text-slate-300 hover:text-white"
                        title="Remover termo"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={novoTermo}
                  onChange={(e) => setNovoTermo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTermo();
                    }
                  }}
                  placeholder="Adicionar termo de busca..."
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddTermo}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          {/* Right column: Minimum Requirements Table */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>
                  Requisitos Técnicos Mínimos (Itens abaixo do mínimo são descartados como C)
                </span>
                <HelpTooltip
                  title="Filtro: Requisitos Técnicos Mínimos (A, B, C)"
                  summary="Regras usadas para julgar cada item homologado dentro das Atas encontradas:"
                  options={[
                    {
                      label: "Operador >=",
                      description:
                        "Aceita valores iguais ou superiores ao mínimo exigido (ex.: 12000 BTUs, 8m x 100m, 200 micras).",
                    },
                    {
                      label: "Operador contém / =",
                      description:
                        "Exige que o termo ou tipo especificado conste na descrição do item (ex.: inverter, diesel, 4x4).",
                    },
                    {
                      label: "Operador compatível (Unidade — Regra R5)",
                      description:
                        "Verifica se a unidade de fornecimento do item na ARP é compatível com a unidade do objeto (sem fazer conversões artificiais).",
                    },
                  ]}
                  align="right"
                />
              </span>
              <button
                type="button"
                onClick={handleAddRequisito}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1B365D]/10 text-[#1B365D] dark:bg-[#B59410]/20 dark:text-[#F3E5AB] hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Requisito
              </button>
            </div>

            {requisitos.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 text-center">
                Nenhum requisito configurado. Clique em Reextrair ou Adicionar Requisito.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                      <th className="py-2 px-2.5">Atributo</th>
                      <th className="py-2 px-2.5">Operador</th>
                      <th className="py-2 px-2.5">Valor</th>
                      <th className="py-2 px-2.5">Unid.</th>
                      <th className="py-2 px-2.5 text-center">Obrigatório</th>
                      <th className="py-2 px-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {requisitos.map((req, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={req.Atributo}
                            onChange={(e) =>
                              handleUpdateRequisito(idx, {
                                Atributo: e.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs font-medium"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <select
                            value={req.Operador}
                            onChange={(e) =>
                              handleUpdateRequisito(idx, {
                                Operador: e.target.value,
                              })
                            }
                            className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs font-mono"
                          >
                            {OPERADORES.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={req.Valor}
                            onChange={(e) =>
                              handleUpdateRequisito(idx, {
                                Valor: e.target.value,
                              })
                            }
                            className="w-24 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={req.Unidade}
                            onChange={(e) =>
                              handleUpdateRequisito(idx, {
                                Unidade: e.target.value,
                              })
                            }
                            className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={req.Obrigatorio}
                            onChange={(e) =>
                              handleUpdateRequisito(idx, {
                                Obrigatorio: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRequisito(idx)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                            title="Remover requisito"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
