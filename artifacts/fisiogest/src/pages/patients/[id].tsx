import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetPatient,
  useGetAnamnesis,
  useCreateAnamnesis,
  useListEvaluations,
  useCreateEvaluation,
  useUpdateEvaluation,
  useDeleteEvaluation,
  useGetTreatmentPlan,
  useSaveTreatmentPlan,
  useListEvolutions,
  useCreateEvolution,
  useUpdateEvolution,
  useDeleteEvolution,
  useGetDischarge,
  useSaveDischarge,
  useUpdatePatient,
  useDeletePatient,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Phone, Mail, Calendar, Activity, ClipboardList, TrendingUp,
  FileText, DollarSign, History, Plus, ChevronDown, ChevronUp, User,
  MapPin, Stethoscope, Target, CheckCircle, Clock, XCircle, AlertCircle,
  LogOut, Pencil, Trash2, ShieldAlert, UserCheck, Lock, Paperclip, Upload,
  FileImage, File, Download, ScrollText, Printer, BadgeCheck, CalendarDays,
  ClipboardCheck, PenLine, Package, Layers, RefreshCw, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DatePickerPTBR } from "@/components/ui/date-picker-ptbr";
import { useAuth } from "@/lib/auth-context";

// ─── Print utilities ─────────────────────────────────────────────────────────

type PatientBasic = { name: string; cpf?: string | null; birthDate?: string | null; phone?: string | null };

function printDocument(html: string, title: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("Permita pop-ups para gerar o documento."); return; }
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="UTF-8"><title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Times New Roman',Times,serif;font-size:11pt;color:#111;background:#fff;padding:2cm 2.5cm}
    h1{font-size:15pt;font-weight:bold;text-align:center;margin-bottom:4px}
    .header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:18px}
    .subtitle{font-size:10pt;color:#333;text-align:center;margin-bottom:4px}
    .patient-box{border:1px solid #999;border-radius:4px;padding:10px 14px;margin-bottom:16px;background:#fafafa}
    .row{display:flex;gap:24px;flex-wrap:wrap;margin-top:4px}
    .field{flex:1;min-width:140px}
    .label{font-size:8.5pt;text-transform:uppercase;color:#555;font-weight:bold;margin-bottom:1px}
    .value{font-size:10.5pt}
    .section{margin-bottom:14px}
    .section-title{font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:#333;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:8px}
    .content-box{background:#f5f5f5;border-radius:3px;padding:8px 12px;line-height:1.6;white-space:pre-wrap;font-size:10.5pt}
    .evo-card{border:1px solid #ddd;border-radius:4px;padding:10px 12px;margin-bottom:10px;page-break-inside:avoid}
    .evo-num{display:inline-flex;align-items:center;justify-content:center;background:#1d4ed8;color:#fff;border-radius:50%;width:22px;height:22px;font-size:9pt;font-weight:bold;margin-right:8px;flex-shrink:0}
    .evo-date{font-size:9pt;color:#666}
    .evo-field{margin-top:6px}
    .fl{font-size:8.5pt;font-weight:bold;color:#555;margin-bottom:1px}
    .fv{font-size:10pt;line-height:1.5}
    .progress-bar{background:#e5e7eb;height:10px;border-radius:5px;margin:6px 0}
    .progress-fill{background:#1d4ed8;height:10px;border-radius:5px}
    .sessions-table{width:100%;border-collapse:collapse;margin-top:8px}
    .sessions-table th{background:#1d4ed8;color:#fff;font-size:9pt;padding:5px 8px;text-align:left}
    .sessions-table td{border:1px solid #e5e7eb;font-size:10pt;padding:5px 8px}
    .sessions-table tr:nth-child(even) td{background:#f9fafb}
    .signature{margin-top:40px;text-align:center}
    .sig-line{border-top:1px solid #000;display:inline-block;width:220px;margin-bottom:4px}
    .sig-label{font-size:9.5pt;color:#444}
    .footer{margin-top:28px;border-top:1px solid #ccc;padding-top:8px;font-size:8pt;color:#888;text-align:center}
    p{margin-bottom:6px;line-height:1.5}
    @media print{@page{margin:1.5cm}body{padding:0}}
  </style></head>
  <body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},400);}</script></body></html>`);
  w.document.close();
}

function generateDischargeHTML(patient: PatientBasic, discharge: Record<string, string>, professional?: { name?: string; council?: string }) {
  const age = patient.birthDate ? differenceInYears(new Date(), parseISO(patient.birthDate)) : null;
  const ageStr = age ? `, ${age} anos` : "";
  const cpfFmt = patient.cpf ? patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—";
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dischargeDate = discharge.dischargeDate
    ? format(parseISO(discharge.dischargeDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : today;
  return `
    <div class="header"><h1>ALTA FISIOTERAPÊUTICA</h1><div class="subtitle">Documento Clínico — Requisito COFFITO</div></div>
    <div class="patient-box">
      <div class="row">
        <div class="field"><div class="label">Paciente</div><div class="value"><strong>${patient.name}${ageStr}</strong></div></div>
        <div class="field"><div class="label">CPF</div><div class="value">${cpfFmt}</div></div>
        ${patient.phone ? `<div class="field"><div class="label">Telefone</div><div class="value">${patient.phone}</div></div>` : ""}
      </div>
      ${patient.birthDate ? `<div class="row"><div class="field"><div class="label">Data de Nascimento</div><div class="value">${format(parseISO(patient.birthDate), "dd/MM/yyyy")}</div></div></div>` : ""}
    </div>
    <div class="section"><div class="section-title">Data da Alta</div><p>${dischargeDate}</p></div>
    <div class="section"><div class="section-title">Motivo da Alta</div><div class="content-box">${discharge.dischargeReason || "—"}</div></div>
    ${discharge.achievedResults ? `<div class="section"><div class="section-title">Resultados Alcançados</div><div class="content-box">${discharge.achievedResults}</div></div>` : ""}
    ${discharge.recommendations ? `<div class="section"><div class="section-title">Recomendações ao Paciente</div><div class="content-box">${discharge.recommendations}</div></div>` : ""}
    <div class="signature">
      <div><div class="sig-line"></div></div>
      <div class="sig-label">${professional?.name || "Fisioterapeuta Responsável"}</div>
      ${professional?.council ? `<div class="sig-label">CREFITO: ${professional.council}</div>` : ""}
    </div>
    <div class="footer">Documento emitido em ${today} &bull; FisioGest Pro</div>
  `;
}

function generateEvolutionsHTML(patient: PatientBasic, evolutions: any[], appointments: any[]) {
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const cpfFmt = patient.cpf ? patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—";
  const sortedAppts = [...appointments].sort((a, b) =>
    new Date(a.date + "T" + (a.startTime || "00:00")).getTime() - new Date(b.date + "T" + (b.startTime || "00:00")).getTime()
  );
  const cards = evolutions.map((ev, idx) => {
    const linkedAppt = appointments.find((a) => a.id === ev.appointmentId);
    let sessionNum = evolutions.length - idx;
    if (ev.appointmentId) { const pos = sortedAppts.findIndex((a) => a.id === ev.appointmentId); if (pos !== -1) sessionNum = pos + 1; }
    const dateStr = ev.createdAt ? format(new Date(ev.createdAt), "dd/MM/yyyy HH:mm") : "";
    const apptInfo = linkedAppt ? `📅 Consulta: ${format(parseISO(linkedAppt.date), "dd/MM/yyyy")} — ${linkedAppt.startTime || ""}` : "";
    return `<div class="evo-card">
      <div style="display:flex;align-items:center;margin-bottom:8px">
        <span class="evo-num">${sessionNum}</span>
        <strong>Sessão ${sessionNum}</strong>
        <span class="evo-date" style="margin-left:auto">${dateStr}</span>
      </div>
      ${apptInfo ? `<div style="font-size:9pt;color:#1d4ed8;margin-bottom:6px">${apptInfo}</div>` : ""}
      ${ev.description ? `<div class="evo-field"><div class="fl">Descrição da Sessão</div><div class="fv">${ev.description}</div></div>` : ""}
      ${ev.patientResponse ? `<div class="evo-field"><div class="fl">Resposta do Paciente</div><div class="fv">${ev.patientResponse}</div></div>` : ""}
      ${ev.clinicalNotes ? `<div class="evo-field"><div class="fl">Notas Clínicas</div><div class="fv">${ev.clinicalNotes}</div></div>` : ""}
      ${ev.complications ? `<div class="evo-field"><div class="fl">Intercorrências</div><div class="fv">${ev.complications}</div></div>` : ""}
    </div>`;
  }).join("");
  return `
    <div class="header"><h1>EVOLUÇÕES FISIOTERAPÊUTICAS</h1><div class="subtitle">Prontuário de Evoluções de Sessão</div></div>
    <div class="patient-box">
      <div class="row">
        <div class="field"><div class="label">Paciente</div><div class="value"><strong>${patient.name}</strong></div></div>
        <div class="field"><div class="label">CPF</div><div class="value">${cpfFmt}</div></div>
        <div class="field"><div class="label">Total de Evoluções</div><div class="value">${evolutions.length}</div></div>
      </div>
    </div>
    ${cards}
    <div class="footer">Documento emitido em ${today} &bull; FisioGest Pro</div>
  `;
}

function generatePlanHTML(patient: PatientBasic, plan: { objectives?: string; techniques?: string; frequency?: string; estimatedSessions?: string | number; status?: string }, appointments: any[]) {
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const completedAppts = [...appointments].filter((a) => a.status === "concluido")
    .sort((a, b) => new Date(b.date + "T" + (b.startTime || "00:00")).getTime() - new Date(a.date + "T" + (a.startTime || "00:00")).getTime());
  const totalCompleted = completedAppts.length;
  const estimated = plan.estimatedSessions ? Number(plan.estimatedSessions) : 0;
  const pct = estimated > 0 ? Math.min(100, (totalCompleted / estimated) * 100) : 0;
  const statusLabel: Record<string, string> = { ativo: "Ativo", concluido: "Concluído", suspenso: "Suspenso" };
  const rows = completedAppts.map((a, i) => `<tr>
    <td>${totalCompleted - i}</td>
    <td>${format(parseISO(a.date), "dd/MM/yyyy")}</td>
    <td>${a.startTime || "—"}</td>
    <td>${a.procedure?.name || "—"}</td>
  </tr>`).join("");
  return `
    <div class="header"><h1>PLANO DE TRATAMENTO</h1><div class="subtitle">Progresso de Sessões</div></div>
    <div class="patient-box">
      <div class="row">
        <div class="field"><div class="label">Paciente</div><div class="value"><strong>${patient.name}</strong></div></div>
        <div class="field"><div class="label">Status</div><div class="value">${statusLabel[plan.status || "ativo"] || "Ativo"}</div></div>
        ${plan.frequency ? `<div class="field"><div class="label">Frequência</div><div class="value">${plan.frequency}</div></div>` : ""}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Progresso de Sessões</div>
      <p><strong>${totalCompleted}</strong> sessão(ões) concluída(s) de <strong>${estimated || "—"}</strong> estimada(s)</p>
      ${estimated > 0 ? `<div class="progress-bar"><div class="progress-fill" style="width:${pct.toFixed(0)}%"></div></div><p style="font-size:9pt;color:#555">${pct.toFixed(1)}% concluído</p>` : ""}
    </div>
    ${plan.objectives ? `<div class="section"><div class="section-title">Objetivos</div><div class="content-box">${plan.objectives}</div></div>` : ""}
    ${plan.techniques ? `<div class="section"><div class="section-title">Técnicas e Recursos</div><div class="content-box">${plan.techniques}</div></div>` : ""}
    ${rows ? `<div class="section"><div class="section-title">Histórico de Sessões</div>
      <table class="sessions-table"><thead><tr><th>#</th><th>Data</th><th>Horário</th><th>Procedimento</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : ""}
    <div class="footer">Documento emitido em ${today} &bull; FisioGest Pro</div>
  `;
}

// ─── Full Prontuário HTML Generator ─────────────────────────────────────────

interface ProntuarioData {
  patient: {
    name: string; cpf?: string | null; birthDate?: string | null;
    phone?: string | null; email?: string | null; address?: string | null;
    profession?: string | null; emergencyContact?: string | null; notes?: string | null;
  };
  anamnesis?: {
    mainComplaint?: string; diseaseHistory?: string; medicalHistory?: string;
    medications?: string; allergies?: string; familyHistory?: string;
    lifestyle?: string; painScale?: number; updatedAt?: string;
  } | null;
  evaluations?: Array<{
    inspection?: string; posture?: string; rangeOfMotion?: string;
    muscleStrength?: string; orthopedicTests?: string; functionalDiagnosis?: string;
    createdAt?: string;
  }>;
  treatmentPlan?: {
    objectives?: string; techniques?: string; frequency?: string;
    estimatedSessions?: string | number; status?: string; updatedAt?: string;
  } | null;
  evolutions?: Array<{
    description?: string; patientResponse?: string; clinicalNotes?: string;
    complications?: string; appointmentId?: number | null; createdAt?: string;
  }>;
  appointments?: Array<{
    id: number; date: string; startTime?: string; status?: string;
    procedure?: { name?: string };
  }>;
  discharge?: {
    dischargeDate?: string; dischargeReason?: string;
    achievedResults?: string; recommendations?: string;
  } | null;
  professional?: { name?: string };
}

function generateFullProntuarioHTML(d: ProntuarioData): { html: string; css: string } {
  const p = d.patient;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const age = p.birthDate ? differenceInYears(new Date(), parseISO(p.birthDate)) : null;
  const cpfFmt = p.cpf ? p.cpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—";
  const evolutions = d.evolutions ?? [];
  const evaluations = d.evaluations ?? [];
  const appointments = d.appointments ?? [];
  const sortedAppts = [...appointments].sort((a, b) =>
    new Date(a.date + "T" + (a.startTime || "00:00")).getTime() -
    new Date(b.date + "T" + (b.startTime || "00:00")).getTime()
  );
  const completedAppts = appointments.filter(a => a.status === "concluido");

  const section = (title: string, icon: string, content: string) => `
    <div class="psection">
      <div class="psection-head"><span class="psection-icon">${icon}</span>${title}</div>
      <div class="psection-body">${content}</div>
    </div>`;

  const textBlock = (label: string, value?: string | null) =>
    value ? `<div class="ptextblock"><div class="ptlabel">${label}</div><div class="ptcontent">${value}</div></div>` : "";

  // ── Patient header ─────────────────────────────────────────────────────────
  const headerHtml = `
    <div class="pdoc-header">
      <div class="pdoc-title">PRONTUÁRIO ELETRÔNICO DO PACIENTE</div>
      <div class="pdoc-subtitle">Documento Clínico Completo — FisioGest Pro</div>
      <div class="pdoc-subtitle">Emitido em ${today}${d.professional?.name ? " por " + d.professional.name : ""}</div>
    </div>
    <div class="ppatient-box">
      <div class="ppatient-name">${p.name}${age ? " — " + age + " anos" : ""}</div>
      <div class="ppatient-row">
        <div class="ppatient-field"><span class="plabel">CPF</span><span class="pvalue">${cpfFmt}</span></div>
        ${p.birthDate ? `<div class="ppatient-field"><span class="plabel">Nascimento</span><span class="pvalue">${format(parseISO(p.birthDate), "dd/MM/yyyy")}</span></div>` : ""}
        ${p.phone ? `<div class="ppatient-field"><span class="plabel">Telefone</span><span class="pvalue">${p.phone}</span></div>` : ""}
        ${p.email ? `<div class="ppatient-field"><span class="plabel">E-mail</span><span class="pvalue">${p.email}</span></div>` : ""}
      </div>
      <div class="ppatient-row">
        ${p.address ? `<div class="ppatient-field"><span class="plabel">Endereço</span><span class="pvalue">${p.address}</span></div>` : ""}
        ${p.profession ? `<div class="ppatient-field"><span class="plabel">Profissão</span><span class="pvalue">${p.profession}</span></div>` : ""}
        ${p.emergencyContact ? `<div class="ppatient-field pfield-emergency"><span class="plabel">Contato de Emergência</span><span class="pvalue">${p.emergencyContact}</span></div>` : ""}
      </div>
      ${p.notes ? `<div class="pnotes">⚠️ <strong>Obs:</strong> ${p.notes}</div>` : ""}
    </div>`;

  // ── Table of contents ──────────────────────────────────────────────────────
  const tocItems: string[] = [];
  if (d.anamnesis) tocItems.push("1. Anamnese");
  if (evaluations.length) tocItems.push("2. Avaliações Físicas (" + evaluations.length + ")");
  if (d.treatmentPlan) tocItems.push("3. Plano de Tratamento");
  if (evolutions.length) tocItems.push("4. Evoluções de Sessão (" + evolutions.length + ")");
  if (d.discharge) tocItems.push("5. Alta Fisioterapêutica");
  const tocHtml = tocItems.length ? `<div class="ptoc"><div class="ptoc-title">Índice</div><ul class="ptoc-list">${tocItems.map(i => `<li>${i}</li>`).join("")}</ul></div>` : "";

  // ── 1. Anamnesis ──────────────────────────────────────────────────────────
  let anamnesisHtml = "";
  if (d.anamnesis) {
    const a = d.anamnesis;
    const painColor = (a.painScale ?? 0) >= 7 ? "#dc2626" : (a.painScale ?? 0) >= 4 ? "#f97316" : "#16a34a";
    anamnesisHtml = section("1. Ficha de Anamnese", "📋", `
      ${d.anamnesis.updatedAt ? `<p class="psec-meta">Atualizada em ${formatDateTime(d.anamnesis.updatedAt)}</p>` : ""}
      ${textBlock("Queixa Principal (QP)", a.mainComplaint)}
      ${textBlock("História da Doença Atual (HDA)", a.diseaseHistory)}
      <div class="ptwo-col">
        ${textBlock("Histórico Médico (HMP)", a.medicalHistory)}
        ${textBlock("Medicamentos em Uso", a.medications)}
        ${textBlock("Alergias", a.allergies)}
        ${textBlock("Histórico Familiar", a.familyHistory)}
      </div>
      ${textBlock("Estilo de Vida", a.lifestyle)}
      ${a.painScale !== undefined ? `<div class="ppain-row">
        <div class="plabel">Escala de Dor (EVA)</div>
        <div class="ppain-bar-wrap">
          <div class="ppain-bar"><div class="ppain-fill" style="width:${(a.painScale / 10) * 100}%;background:${painColor}"></div></div>
          <span class="ppain-val" style="color:${painColor}">${a.painScale}/10</span>
        </div>
      </div>` : ""}
    `);
  }

  // ── 2. Evaluations ─────────────────────────────────────────────────────────
  let evaluationsHtml = "";
  if (evaluations.length) {
    const cards = evaluations.map((ev, idx) => {
      const num = evaluations.length - idx;
      const dateStr = ev.createdAt ? formatDateTime(ev.createdAt) : "";
      return `<div class="pevo-card">
        <div class="pevo-head"><span class="pevo-num">${num}</span><strong>Avaliação #${num}</strong><span class="pevo-date">${dateStr}</span></div>
        <div class="ptwo-col">
          ${textBlock("Inspeção", ev.inspection)}
          ${textBlock("Postura", ev.posture)}
          ${textBlock("Amplitude de Movimento", ev.rangeOfMotion)}
          ${textBlock("Força Muscular", ev.muscleStrength)}
        </div>
        ${textBlock("Testes Ortopédicos", ev.orthopedicTests)}
        ${textBlock("Diagnóstico Funcional", ev.functionalDiagnosis)}
      </div>`;
    }).join("");
    evaluationsHtml = section("2. Avaliações Físicas", "🔍", cards);
  }

  // ── 3. Treatment Plan ─────────────────────────────────────────────────────
  let planHtml = "";
  if (d.treatmentPlan) {
    const pl = d.treatmentPlan;
    const statusLabel: Record<string, string> = { ativo: "Ativo", concluido: "Concluído", suspenso: "Suspenso" };
    const estimated = pl.estimatedSessions ? Number(pl.estimatedSessions) : 0;
    const pct = estimated > 0 ? Math.min(100, (completedAppts.length / estimated) * 100) : 0;
    const rows = completedAppts
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((a, i) => `<tr><td>${i + 1}</td><td>${format(parseISO(a.date), "dd/MM/yyyy")}</td><td>${a.startTime || "—"}</td><td>${a.procedure?.name || "—"}</td></tr>`)
      .join("");
    planHtml = section("3. Plano de Tratamento", "🎯", `
      ${pl.updatedAt ? `<p class="psec-meta">Atualizado em ${formatDateTime(pl.updatedAt)}</p>` : ""}
      <div class="pplan-status">Status: <strong>${statusLabel[pl.status || "ativo"] || "Ativo"}</strong>${pl.frequency ? " &bull; Frequência: <strong>" + pl.frequency + "</strong>" : ""}${estimated ? " &bull; Sessões estimadas: <strong>" + estimated + "</strong>" : ""}</div>
      ${estimated > 0 ? `<div class="pprogress-wrap">
        <div class="plabel">Progresso: ${completedAppts.length} de ${estimated} sessões (${pct.toFixed(1)}%)</div>
        <div class="ppain-bar" style="margin-top:4px"><div class="ppain-fill" style="width:${pct.toFixed(0)}%;background:#1d4ed8"></div></div>
      </div>` : ""}
      ${textBlock("Objetivos", pl.objectives)}
      ${textBlock("Técnicas e Recursos", pl.techniques)}
      ${rows ? `<div class="ptextblock"><div class="ptlabel">Histórico de Sessões Concluídas</div>
        <table class="psessions-table"><thead><tr><th>#</th><th>Data</th><th>Horário</th><th>Procedimento</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : ""}
    `);
  }

  // ── 4. Evolutions ──────────────────────────────────────────────────────────
  let evolutionsHtml = "";
  if (evolutions.length) {
    const cards = evolutions.map((ev, idx) => {
      const linkedAppt = appointments.find(a => a.id === ev.appointmentId);
      let sessionNum = evolutions.length - idx;
      if (ev.appointmentId) {
        const pos = sortedAppts.findIndex(a => a.id === ev.appointmentId);
        if (pos !== -1) sessionNum = pos + 1;
      }
      const dateStr = ev.createdAt ? formatDateTime(ev.createdAt) : "";
      const apptInfo = linkedAppt ? `📅 Consulta vinculada: ${format(parseISO(linkedAppt.date), "dd/MM/yyyy")} — ${linkedAppt.startTime || ""}` : "";
      return `<div class="pevo-card">
        <div class="pevo-head"><span class="pevo-num">${sessionNum}</span><strong>Sessão ${sessionNum}</strong><span class="pevo-date">${dateStr}</span></div>
        ${apptInfo ? `<div class="pevo-appt">${apptInfo}</div>` : ""}
        ${textBlock("Descrição da Sessão", ev.description)}
        ${textBlock("Resposta do Paciente", ev.patientResponse)}
        ${textBlock("Notas Clínicas", ev.clinicalNotes)}
        ${ev.complications ? `<div class="ptextblock pcomplication">${textBlock("⚠️ Intercorrências", ev.complications)}</div>` : ""}
      </div>`;
    }).join("");
    evolutionsHtml = section("4. Evoluções de Sessão", "📈", cards);
  }

  // ── 5. Discharge ──────────────────────────────────────────────────────────
  let dischargeHtml = "";
  if (d.discharge) {
    const dc = d.discharge;
    const dischargeDate = dc.dischargeDate
      ? format(parseISO(dc.dischargeDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : today;
    dischargeHtml = section("5. Alta Fisioterapêutica", "✅", `
      <div class="pplan-status">Data da Alta: <strong>${dischargeDate}</strong></div>
      ${textBlock("Motivo da Alta", dc.dischargeReason)}
      ${textBlock("Resultados Alcançados", dc.achievedResults)}
      ${textBlock("Recomendações ao Paciente", dc.recommendations)}
    `);
  }

  // ── Signature ──────────────────────────────────────────────────────────────
  const signatureHtml = `
    <div class="psignature">
      <div class="psig-line"></div>
      <div class="psig-name">${d.professional?.name || "Fisioterapeuta Responsável"}</div>
      <div class="psig-label">Profissional Responsável pelo Prontuário</div>
    </div>
    <div class="pfooter">
      Prontuário gerado em ${today} &bull; FisioGest Pro &bull; Documento de uso clínico — COFFITO
    </div>`;

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;color:#1e293b;background:#fff;padding:1.5cm 2cm}
    .pdoc-header{text-align:center;border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:20px}
    .pdoc-title{font-size:16pt;font-weight:800;color:#1d4ed8;letter-spacing:.5px;margin-bottom:4px}
    .pdoc-subtitle{font-size:9pt;color:#64748b;margin-top:2px}
    .ppatient-box{border:2px solid #1d4ed8;border-radius:8px;padding:14px 18px;margin-bottom:20px;background:#eff6ff}
    .ppatient-name{font-size:14pt;font-weight:800;color:#1e3a8a;margin-bottom:10px}
    .ppatient-row{display:flex;flex-wrap:wrap;gap:12px 24px;margin-bottom:6px}
    .ppatient-field{display:flex;flex-direction:column;min-width:150px}
    .pfield-emergency{background:#fef9c3;border:1px solid #fbbf24;border-radius:4px;padding:4px 8px}
    .plabel{font-size:8pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:2px}
    .pvalue{font-size:10pt;color:#1e293b;font-weight:500}
    .pnotes{margin-top:8px;font-size:9pt;color:#92400e;background:#fffbeb;border-radius:4px;padding:6px 10px}
    .ptoc{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;background:#f8fafc}
    .ptoc-title{font-weight:700;font-size:10pt;margin-bottom:6px;color:#1e293b}
    .ptoc-list{list-style:none;display:flex;flex-wrap:wrap;gap:4px 24px}
    .ptoc-list li{font-size:9.5pt;color:#475569}
    .psection{margin-bottom:24px;page-break-inside:avoid}
    .psection-head{font-size:12pt;font-weight:800;color:#1e3a8a;border-bottom:2px solid #1d4ed8;padding-bottom:6px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
    .psection-icon{font-size:13pt}
    .psection-body{}
    .psec-meta{font-size:8.5pt;color:#94a3b8;margin-bottom:10px;font-style:italic}
    .ptextblock{margin-bottom:10px}
    .ptlabel{font-size:8.5pt;font-weight:700;text-transform:uppercase;color:#475569;margin-bottom:3px}
    .ptcontent{background:#f8fafc;border-left:3px solid #cbd5e1;padding:8px 12px;font-size:10pt;line-height:1.6;white-space:pre-wrap;border-radius:0 4px 4px 0;color:#1e293b}
    .ptwo-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
    .pplan-status{font-size:10pt;margin-bottom:10px;color:#1e293b;background:#f1f5f9;padding:8px 12px;border-radius:6px}
    .pprogress-wrap{margin-bottom:10px}
    .ppain-row{margin-top:10px}
    .ppain-bar-wrap{display:flex;align-items:center;gap:10px;margin-top:4px}
    .ppain-bar{background:#e2e8f0;height:10px;border-radius:5px;flex:1}
    .ppain-fill{height:10px;border-radius:5px}
    .ppain-val{font-weight:800;font-size:13pt;min-width:36px}
    .pevo-card{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:12px;page-break-inside:avoid}
    .pevo-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;border-bottom:1px solid #f1f5f9;padding-bottom:8px}
    .pevo-num{display:inline-flex;align-items:center;justify-content:center;background:#1d4ed8;color:#fff;border-radius:50%;width:24px;height:24px;font-size:9pt;font-weight:800;flex-shrink:0}
    .pevo-date{font-size:9pt;color:#94a3b8;margin-left:auto}
    .pevo-appt{font-size:9pt;color:#1d4ed8;margin-bottom:8px;font-style:italic}
    .pcomplication .ptcontent{border-left-color:#ef4444;background:#fef2f2}
    .psessions-table{width:100%;border-collapse:collapse;margin-top:8px;font-size:9.5pt}
    .psessions-table th{background:#1d4ed8;color:#fff;padding:5px 8px;text-align:left;font-weight:700}
    .psessions-table td{border:1px solid #e2e8f0;padding:5px 8px}
    .psessions-table tr:nth-child(even) td{background:#f8fafc}
    .psignature{margin-top:50px;text-align:center}
    .psig-line{border-top:1px solid #94a3b8;display:inline-block;width:250px;margin-bottom:6px}
    .psig-name{font-size:11pt;font-weight:700;color:#1e293b}
    .psig-label{font-size:9pt;color:#64748b}
    .pfooter{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:8pt;color:#94a3b8;text-align:center}
    @media print{@page{margin:1.5cm 2cm}body{padding:0}.psection{page-break-inside:avoid}}
  `;

  return { html: `${headerHtml}${tocHtml}${anamnesisHtml}${evaluationsHtml}${planHtml}${evolutionsHtml}${dischargeHtml}${signatureHtml}`, css };
}

// ─── Export Prontuário Button ────────────────────────────────────────────────

function ExportProntuarioButton({ patientId, patient }: { patientId: number; patient: any }) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const token = () => localStorage.getItem("fisiogest_token");

  const handleExport = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token()}` };
      const [anamnesisRes, evaluationsRes, planRes, evolutionsRes, appointmentsRes, dischargeRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/anamnesis`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`/api/patients/${patientId}/evaluations`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`/api/patients/${patientId}/treatment-plan`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`/api/patients/${patientId}/evolutions`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`/api/patients/${patientId}/appointments`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`/api/patients/${patientId}/discharge`, { headers }).then(r => r.ok ? r.json() : null),
      ]);

      const { html, css } = generateFullProntuarioHTML({
        patient,
        anamnesis: anamnesisRes,
        evaluations: evaluationsRes,
        treatmentPlan: planRes,
        evolutions: evolutionsRes,
        appointments: appointmentsRes,
        discharge: dischargeRes,
        professional: { name: (user as any)?.name },
      });

      const w = window.open("", "_blank", "width=960,height=800");
      if (!w) { alert("Permita pop-ups para gerar o prontuário."); return; }
      w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
        <meta charset="UTF-8"><title>Prontuário — ${patient.name}</title>
        <style>${css}</style>
      </head><body>${html}
        <script>window.onload=function(){setTimeout(function(){window.print();},600);}<\/script>
      </body></html>`);
      w.document.close();
    } catch (err) {
      console.error("Erro ao gerar prontuário:", err);
      alert("Não foi possível gerar o prontuário. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full h-9 rounded-xl text-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400"
      onClick={handleExport}
      disabled={loading}
    >
      {loading
        ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Gerando…</>
        : <><FileText className="w-3.5 h-3.5 mr-2" /> Exportar Prontuário PDF</>
      }
    </Button>
  );
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  agendado: { label: "Agendado", color: "bg-blue-100 text-blue-700", icon: <Clock className="w-3 h-3" /> },
  confirmado: { label: "Confirmado", color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
  concluido: { label: "Concluído", color: "bg-slate-100 text-slate-700", icon: <CheckCircle className="w-3 h-3" /> },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
  faltou: { label: "Faltou", color: "bg-orange-100 text-orange-700", icon: <AlertCircle className="w-3 h-3" /> },
};

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string) {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function InfoBlock({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

// ─── Exam Attachments ───────────────────────────────────────────────────────────

type ExamAttachment = {
  id: number;
  patientId: number;
  examTitle: string | null;
  originalFilename: string | null;
  contentType: string | null;
  fileSize: number | null;
  objectPath: string | null;
  description: string | null;
  resultText: string | null;
  uploadedAt: string;
};

const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentTypeIcon({ contentType }: { contentType: string | null }) {
  if (!contentType) return <FileText className="w-5 h-5 text-indigo-400" />;
  if (contentType.startsWith("image/")) return <FileImage className="w-5 h-5 text-blue-500" />;
  if (contentType === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

function ExamAttachmentsSection({ patientId }: { patientId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addMode, setAddMode] = useState<null | "text" | "file">(null);
  const [uploading, setUploading] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [textForm, setTextForm] = useState({ examTitle: "", resultText: "" });

  const token = () => localStorage.getItem("fisiogest_token");

  const { data: attachments = [], isLoading } = useQuery<ExamAttachment[]>({
    queryKey: [`/api/patients/${patientId}/attachments`],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${patientId}/attachments`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar anexos");
      return res.json();
    },
  });

  const handleSaveText = async () => {
    if (!textForm.resultText.trim()) {
      toast({ title: "Resultado obrigatório", description: "Digite o resultado do exame.", variant: "destructive" });
      return;
    }
    setSavingText(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ examTitle: textForm.examTitle || null, resultText: textForm.resultText }),
      });
      if (!res.ok) throw new Error("Falha ao salvar resultado");
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/attachments`] });
      toast({ title: "Resultado salvo" });
      setTextForm({ examTitle: "", resultText: "" });
      setAddMode(null);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingText(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast({ title: "Tipo não suportado", description: "Aceitos: PDF, DOCX, JPG, PNG, WebP.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Tamanho máximo: 20 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    setAddMode(null);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Falha ao obter URL de upload");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Falha ao enviar arquivo");

      const metaRes = await fetch(`/api/patients/${patientId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ originalFilename: file.name, contentType: file.type, fileSize: file.size, objectPath }),
      });
      if (!metaRes.ok) throw new Error("Falha ao registrar anexo");

      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/attachments`] });
      toast({ title: "Arquivo enviado", description: file.name });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (att: ExamAttachment) => {
    if (!att.objectPath || !att.originalFilename) return;
    try {
      const res = await fetch(`/api/storage${att.objectPath}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error("Falha ao baixar arquivo");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.originalFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao baixar", description: "Não foi possível baixar o arquivo.", variant: "destructive" });
    }
  };

  const handleDelete = async (att: ExamAttachment) => {
    setDeletingId(att.id);
    try {
      const res = await fetch(`/api/patients/${patientId}/attachments/${att.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/attachments`] });
      toast({ title: "Registro removido" });
    } catch {
      toast({ title: "Erro ao remover", description: "Não foi possível remover o registro.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3 pt-4 border-t border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Anexos e Exames Complementares</span>
          {attachments.length > 0 && (
            <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">
              {attachments.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={addMode === "text" ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={uploading}
            onClick={() => setAddMode(addMode === "text" ? null : "text")}
          >
            <FileText className="w-3.5 h-3.5" />
            Digitar resultado
          </Button>
          <Button
            variant={uploading ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={uploading}
            onClick={() => { setAddMode(null); fileInputRef.current?.click(); }}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Enviando..." : "Anexar arquivo"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Inline text entry form */}
      {addMode === "text" && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Novo resultado de exame</p>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Nome do exame</Label>
            <Input
              className="h-8 text-sm bg-white border-slate-200"
              placeholder="Ex: Hemograma Completo, Raio-X Coluna..."
              value={textForm.examTitle}
              onChange={e => setTextForm(f => ({ ...f, examTitle: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Resultado <span className="text-red-400">*</span></Label>
            <Textarea
              className="min-h-[100px] text-sm bg-white border-slate-200 resize-none"
              placeholder="Digite o resultado do exame, laudos, observações..."
              value={textForm.resultText}
              onChange={e => setTextForm(f => ({ ...f, resultText: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setAddMode(null); setTextForm({ examTitle: "", resultText: "" }); }}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8 text-xs" disabled={savingText} onClick={handleSaveText}>
              {savingText && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Salvar resultado
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && attachments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Paperclip className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhum exame registrado</p>
          <p className="text-xs mt-0.5">Digite o resultado ou anexe um arquivo</p>
        </div>
      )}

      {/* List */}
      {!isLoading && attachments.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
          {attachments.map((att) => {
            const isText = !att.objectPath && att.resultText;
            const isExpanded = expandedId === att.id;
            const title = att.examTitle || att.originalFilename || "Sem título";
            return (
              <div key={att.id} className="bg-white hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <AttachmentTypeIcon contentType={att.contentType} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{title}</p>
                    <p className="text-xs text-slate-400">
                      {isText
                        ? `Resultado digitado · ${formatDateTime(att.uploadedAt)}`
                        : `${att.fileSize ? formatFileSize(att.fileSize) : ""} · ${formatDateTime(att.uploadedAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {att.resultText && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-indigo-500"
                        title={isExpanded ? "Recolher" : "Ver resultado"}
                        onClick={() => setExpandedId(isExpanded ? null : att.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    {att.objectPath && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary"
                        title="Baixar arquivo"
                        onClick={() => handleDownload(att)}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-500"
                      title="Remover"
                      disabled={deletingId === att.id}
                      onClick={() => handleDelete(att)}
                    >
                      {deletingId === att.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                {isExpanded && att.resultText && (
                  <div className="px-11 pb-3">
                    <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 px-3 py-2.5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {att.resultText}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Anamnesis Tab ──────────────────────────────────────────────────────────────

function AnamnesisTab({ patientId }: { patientId: number }) {
  const { data, isLoading } = useGetAnamnesis(patientId);
  const mutation = useCreateAnamnesis();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    mainComplaint: "", diseaseHistory: "", medicalHistory: "",
    medications: "", allergies: "", familyHistory: "", lifestyle: "", painScale: 0,
  });

  useEffect(() => {
    if (data) {
      setForm({
        mainComplaint: data.mainComplaint || "",
        diseaseHistory: data.diseaseHistory || "",
        medicalHistory: data.medicalHistory || "",
        medications: data.medications || "",
        allergies: data.allergies || "",
        familyHistory: data.familyHistory || "",
        lifestyle: data.lifestyle || "",
        painScale: data.painScale || 0,
      });
    }
  }, [data]);

  const handleSave = () => {
    mutation.mutate({ patientId, data: form }, {
      onSuccess: () => {
        toast({ title: "Salvo com sucesso", description: "Anamnese atualizada." });
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/anamnesis`] });
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-xl">Ficha de Anamnese</CardTitle>
            <CardDescription>Histórico completo de saúde do paciente</CardDescription>
          </div>
          {data?.updatedAt && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 shrink-0">
              <Clock className="w-3 h-3" />
              Atualizado em {formatDateTime(data.updatedAt)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Queixa Principal (QP)</Label>
          <Textarea className="min-h-[90px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.mainComplaint} onChange={e => setForm({ ...form, mainComplaint: e.target.value })}
            placeholder="Relato do paciente sobre o motivo da consulta..." />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">História da Doença Atual (HDA)</Label>
          <Textarea className="min-h-[90px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.diseaseHistory} onChange={e => setForm({ ...form, diseaseHistory: e.target.value })}
            placeholder="Evolução dos sintomas, início, fatores agravantes..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Histórico Médico (HMP)</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
              value={form.medicalHistory} onChange={e => setForm({ ...form, medicalHistory: e.target.value })}
              placeholder="Cirurgias, internações, doenças..." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Medicamentos em Uso</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
              value={form.medications} onChange={e => setForm({ ...form, medications: e.target.value })}
              placeholder="Nome e dosagem dos medicamentos..." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Alergias</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
              value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })}
              placeholder="Alergias a medicamentos, alimentos..." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Histórico Familiar</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
              value={form.familyHistory} onChange={e => setForm({ ...form, familyHistory: e.target.value })}
              placeholder="Doenças hereditárias, histórico familiar..." />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Estilo de Vida</Label>
          <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.lifestyle} onChange={e => setForm({ ...form, lifestyle: e.target.value })}
            placeholder="Atividade física, sono, alimentação, trabalho..." />
        </div>
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-semibold text-slate-700">Escala de Dor (EVA)</Label>
            <span className={`font-bold text-xl ${form.painScale >= 7 ? "text-red-500" : form.painScale >= 4 ? "text-orange-500" : "text-green-500"}`}>
              {form.painScale} / 10
            </span>
          </div>
          <Slider value={[form.painScale]} max={10} step={1}
            onValueChange={val => setForm({ ...form, painScale: val[0] })} className="py-2" />
          <div className="flex justify-between text-xs font-medium text-slate-400">
            <span>Sem dor (0)</span><span>Moderada (5)</span><span>Insuportável (10)</span>
          </div>
        </div>
        <ExamAttachmentsSection patientId={patientId} />

        <div className="pt-3 flex justify-end">
          <Button onClick={handleSave} className="h-11 px-8 rounded-xl shadow-md shadow-primary/20" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Anamnese
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Evaluations Tab ────────────────────────────────────────────────────────────

const emptyEvalForm = { inspection: "", posture: "", rangeOfMotion: "", muscleStrength: "", orthopedicTests: "", functionalDiagnosis: "" };

function EvaluationsTab({ patientId }: { patientId: number }) {
  const { data: evaluations = [], isLoading } = useListEvaluations(patientId);
  const createMutation = useCreateEvaluation();
  const updateMutation = useUpdateEvaluation();
  const deleteMutation = useDeleteEvaluation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyEvalForm);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/evaluations`] });

  const handleCreate = () => {
    createMutation.mutate({ patientId, data: form }, {
      onSuccess: () => {
        toast({ title: "Avaliação criada", description: "Nova avaliação registrada com sucesso." });
        invalidate();
        setForm(emptyEvalForm);
        setShowForm(false);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  const handleUpdate = (id: number) => {
    updateMutation.mutate({ patientId, evaluationId: id, data: form }, {
      onSuccess: () => {
        toast({ title: "Avaliação atualizada", description: "Alterações salvas com sucesso." });
        invalidate();
        setEditingId(null);
        setForm(emptyEvalForm);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Excluir esta avaliação permanentemente?")) return;
    deleteMutation.mutate({ patientId, evaluationId: id }, {
      onSuccess: () => {
        toast({ title: "Avaliação excluída" });
        invalidate();
        if (expandedId === id) setExpandedId(null);
      },
      onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });
  };

  const startEdit = (ev: any) => {
    setEditingId(ev.id);
    setExpandedId(null);
    setShowForm(false);
    setForm({
      inspection: ev.inspection || "",
      posture: ev.posture || "",
      rangeOfMotion: ev.rangeOfMotion || "",
      muscleStrength: ev.muscleStrength || "",
      orthopedicTests: ev.orthopedicTests || "",
      functionalDiagnosis: ev.functionalDiagnosis || "",
    });
  };

  const EvalForm = ({ onSave, onCancel, saving, title }: { onSave: () => void; onCancel: () => void; saving: boolean; title: string }) => (
    <Card className="border-2 border-primary/20 shadow-md">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "inspection", label: "Inspeção", placeholder: "Postura geral, assimetrias observadas..." },
            { key: "posture", label: "Postura", placeholder: "Análise anterior, posterior e lateral..." },
            { key: "rangeOfMotion", label: "Amplitude de Movimento", placeholder: "Graus de movimento, limitações..." },
            { key: "muscleStrength", label: "Força Muscular", placeholder: "Graus de força (0-5), grupos musculares..." },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">{f.label}</Label>
              <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 resize-none text-sm"
                value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Testes Ortopédicos</Label>
          <Textarea className="min-h-[70px] bg-slate-50 border-slate-200 resize-none text-sm"
            value={form.orthopedicTests} onChange={e => setForm({ ...form, orthopedicTests: e.target.value })}
            placeholder="Testes realizados e resultados..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Diagnóstico Funcional</Label>
          <Textarea className="min-h-[70px] bg-slate-50 border-slate-200 resize-none text-sm"
            value={form.functionalDiagnosis} onChange={e => setForm({ ...form, functionalDiagnosis: e.target.value })}
            placeholder="Conclusão da avaliação e objetivos do tratamento..." />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancelar</Button>
          <Button onClick={onSave} className="rounded-xl" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Avaliação
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Avaliações Físicas</h3>
          <p className="text-sm text-slate-500">{evaluations.length} avaliação(ões) registrada(s)</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyEvalForm); }} className="h-10 px-5 rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> Nova Avaliação
        </Button>
      </div>

      {showForm && !editingId && (
        <EvalForm
          title="Nova Avaliação Fisioterapêutica"
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm(emptyEvalForm); }}
          saving={createMutation.isPending}
        />
      )}

      {evaluations.length === 0 && !showForm ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-12 text-center text-slate-400">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma avaliação registrada</p>
            <p className="text-sm mt-1">Clique em "Nova Avaliação" para adicionar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev, idx) => (
            <div key={ev.id}>
              {editingId === ev.id ? (
                <EvalForm
                  title={`Editar Avaliação #${evaluations.length - idx}`}
                  onSave={() => handleUpdate(ev.id)}
                  onCancel={() => { setEditingId(null); setForm(emptyEvalForm); }}
                  saving={updateMutation.isPending}
                />
              ) : (
                <Card className="border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <button
                      className="flex items-center gap-3 flex-1 text-left"
                      onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                        {evaluations.length - idx}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Avaliação #{evaluations.length - idx}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(ev.createdAt)}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 ml-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-primary"
                        onClick={() => startEdit(ev)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                        onClick={() => handleDelete(ev.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      {expandedId === ev.id ? <ChevronUp className="w-4 h-4 text-slate-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />}
                    </div>
                  </div>
                  {expandedId === ev.id && (
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      {ev.inspection && <InfoBlock label="Inspeção" value={ev.inspection} />}
                      {ev.posture && <InfoBlock label="Postura" value={ev.posture} />}
                      {ev.rangeOfMotion && <InfoBlock label="Amplitude de Movimento" value={ev.rangeOfMotion} />}
                      {ev.muscleStrength && <InfoBlock label="Força Muscular" value={ev.muscleStrength} />}
                      {ev.orthopedicTests && <InfoBlock label="Testes Ortopédicos" value={ev.orthopedicTests} className="md:col-span-2" />}
                      {ev.functionalDiagnosis && <InfoBlock label="Diagnóstico Funcional" value={ev.functionalDiagnosis} className="md:col-span-2" />}
                    </div>
                  )}
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Treatment Plan Items Section ────────────────────────────────────────────────

interface PkgOption {
  id: number;
  name: string;
  procedureName: string;
  packageType: "sessoes" | "mensal";
  totalSessions?: number | null;
  sessionsPerWeek: number;
  validityDays?: number | null;
  price: string | number;
  monthlyPrice?: string | number | null;
  billingDay?: number | null;
  absenceCreditLimit: number;
  procedurePricePerSession: string | number;
}

interface PlanProcedureItem {
  id: number;
  planId: number;
  packageId?: number | null;
  procedureId?: number | null;
  sessionsPerWeek: number;
  totalSessions?: number | null;
  notes?: string | null;
  packageName?: string | null;
  procedureName?: string | null;
  packageType?: string | null;
  monthlyPrice?: string | null;
  billingDay?: number | null;
  absenceCreditLimit?: number;
  price?: string | null;
}

function fmtCur(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

function TreatmentPlanItemsSection({ planId, patientId }: { planId: number | undefined; patientId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addMode, setAddMode] = useState<"package" | "procedure" | null>(null);
  const [selectedPkgId, setSelectedPkgId] = useState("");
  const [selectedProcId, setSelectedProcId] = useState("");
  const [itemSpw, setItemSpw] = useState(2);
  const [itemSessions, setItemSessions] = useState<string>("");
  const [itemNotes, setItemNotes] = useState("");

  const planItemsKey = planId ? [`/api/treatment-plans/${planId}/procedures`] : null;

  const { data: planItems = [] } = useQuery<PlanProcedureItem[]>({
    queryKey: planItemsKey ?? ["plan-items-disabled"],
    queryFn: () => fetch(`/api/treatment-plans/${planId}/procedures`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` },
    }).then(r => r.json()),
    enabled: !!planId,
  });

  const { data: packages = [] } = useQuery<PkgOption[]>({
    queryKey: ["packages"],
    queryFn: () => fetch("/api/packages", {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` },
    }).then(r => r.json()),
  });

  const { data: procedures = [] } = useQuery<{ id: number; name: string; price: string | number; durationMinutes: number }[]>({
    queryKey: ["procedures-active"],
    queryFn: () => fetch("/api/procedures", {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` },
    }).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (body: object) => fetch(`/api/treatment-plans/${planId}/procedures`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` },
      body: JSON.stringify(body),
    }).then(async r => {
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.message || "Erro ao adicionar"); }
      return r.json();
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planItemsKey ?? [] });
      toast({ title: "Item adicionado ao plano!" });
      setAddMode(null);
      setSelectedPkgId(""); setSelectedProcId(""); setItemSpw(2); setItemSessions(""); setItemNotes("");
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: number) => fetch(`/api/treatment-plans/${planId}/procedures/${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` },
    }).then(r => { if (!r.ok) throw new Error("Erro ao remover"); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planItemsKey ?? [] });
      toast({ title: "Item removido do plano." });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  function handleAddSubmit() {
    if (!planId) return;
    if (addMode === "package" && !selectedPkgId) { toast({ title: "Selecione um pacote", variant: "destructive" }); return; }
    if (addMode === "procedure" && !selectedProcId) { toast({ title: "Selecione um procedimento", variant: "destructive" }); return; }

    const body: any = {
      sessionsPerWeek: itemSpw,
      totalSessions: itemSessions ? Number(itemSessions) : null,
      notes: itemNotes || null,
    };
    if (addMode === "package") body.packageId = Number(selectedPkgId);
    else body.procedureId = Number(selectedProcId);

    addMutation.mutate(body);
  }

  // Financial forecast
  const totalMensal = planItems
    .filter(i => i.packageType === "mensal")
    .reduce((s, i) => s + Number(i.monthlyPrice ?? i.price ?? 0), 0);

  // For avulso procedures: multiply price/session × totalSessions
  // For session packages: use the package total price
  const totalSessoes = planItems
    .filter(i => i.packageType === "sessoes" || (!i.packageType && i.procedureId))
    .reduce((s, i) => {
      if (!i.packageType && i.procedureId) {
        return s + Number(i.price ?? 0) * (i.totalSessions ?? 1);
      }
      return s + Number(i.price ?? 0);
    }, 0);

  const totalSessions = planItems.reduce((s, i) => {
    if (i.packageType === "mensal") return s;
    return s + (i.totalSessions ?? 0);
  }, 0);

  // Estimated weeks (max across items with session data)
  const estimatedWeeks = planItems
    .filter(i => i.packageType !== "mensal" && i.totalSessions && i.sessionsPerWeek > 0)
    .reduce((max, i) => {
      const weeks = Math.ceil((i.totalSessions ?? 0) / i.sessionsPerWeek);
      return Math.max(max, weeks);
    }, 0);

  const hasMensal = planItems.some(i => i.packageType === "mensal");
  const hasSessoes = planItems.some(i => i.packageType === "sessoes" || (!i.packageType && i.procedureId));

  if (!planId) return null;

  return (
    <div className="pt-4 border-t border-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Procedimentos e Pacotes do Plano
        </p>
        {addMode === null && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2.5" onClick={() => setAddMode("package")}>
              <Plus className="h-3 w-3" /> Pacote
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2.5" onClick={() => setAddMode("procedure")}>
              <Plus className="h-3 w-3" /> Avulso
            </Button>
          </div>
        )}
      </div>

      {/* Add form */}
      {addMode !== null && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-600">
            {addMode === "package" ? "Adicionar pacote ao plano" : "Adicionar procedimento avulso"}
          </p>

          {addMode === "package" ? (
            <Select value={selectedPkgId} onValueChange={setSelectedPkgId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione o pacote..." />
              </SelectTrigger>
              <SelectContent>
                {packages.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <span className="flex items-center gap-2">
                      {p.packageType === "mensal"
                        ? <RefreshCw className="h-3 w-3 text-emerald-500 shrink-0" />
                        : <Layers className="h-3 w-3 text-blue-500 shrink-0" />}
                      <span>{p.name}</span>
                      <span className="text-muted-foreground text-xs ml-1">
                        {p.packageType === "mensal"
                          ? `${fmtCur(p.monthlyPrice)}/mês`
                          : `${p.totalSessions} sessões · ${fmtCur(p.price)}`}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedProcId} onValueChange={setSelectedProcId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione o procedimento..." />
              </SelectTrigger>
              <SelectContent>
                {procedures.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} — {fmtCur(p.price)}/sessão
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="grid grid-cols-2 gap-2">
            {addMode === "procedure" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Sessões/semana</Label>
                  <Select value={String(itemSpw)} onValueChange={v => setItemSpw(Number(v))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n}x/sem</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total de sessões</Label>
                  <Input className="h-8 text-xs" type="number" min={1} placeholder="Ex: 20" value={itemSessions} onChange={e => setItemSessions(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações <span className="text-muted-foreground">(opcional)</span></Label>
            <Input className="h-8 text-xs" placeholder="Ex: iniciar com baixa carga..." value={itemNotes} onChange={e => setItemNotes(e.target.value)} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddMode(null); setSelectedPkgId(""); setSelectedProcId(""); }}>
              Cancelar
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleAddSubmit} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Items list */}
      {planItems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">
          Nenhum procedimento ou pacote vinculado ao plano ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {planItems.map((item) => {
            const isMensal = item.packageType === "mensal";
            const isAvulso = !item.packageId;
            return (
              <div key={item.id} className="flex items-start justify-between gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    {item.packageId ? (
                      isMensal
                        ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-0.5"><RefreshCw className="h-2.5 w-2.5" /> Mensal</span>
                        : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-0.5"><Layers className="h-2.5 w-2.5" /> Sessões</span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Avulso</span>
                    )}
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {item.packageName ?? item.procedureName ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-0.5">
                    {item.sessionsPerWeek > 0 && !isMensal && (
                      <span>{item.sessionsPerWeek}x/semana</span>
                    )}
                    {item.totalSessions && !isMensal && (
                      <span>{item.totalSessions} sessões</span>
                    )}
                    {item.totalSessions && item.sessionsPerWeek > 0 && !isMensal && (
                      <span className="text-slate-400">
                        ~{Math.ceil(item.totalSessions / item.sessionsPerWeek)} sem.
                      </span>
                    )}
                    {isMensal && (
                      <span>{fmtCur(item.monthlyPrice)}/mês · dia {item.billingDay ?? "—"} · {item.sessionsPerWeek}x/sem</span>
                    )}
                    {isMensal && (item.absenceCreditLimit ?? 0) > 0 && (
                      <span className="text-emerald-600 font-medium">{item.absenceCreditLimit} falta(s) c/ crédito</span>
                    )}
                    {!isMensal && item.price && (
                      <span className="font-medium text-slate-700">
                        {isAvulso && item.totalSessions
                          ? <>{fmtCur(Number(item.price) * item.totalSessions)} total</>
                          : fmtCur(item.price)}
                      </span>
                    )}
                    {item.notes && <span className="text-slate-400 italic">{item.notes}</span>}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-400 hover:text-destructive shrink-0 mt-0.5"
                  onClick={() => removeMutation.mutate(item.id)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Financial Forecast */}
      {planItems.length > 0 && (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Previsão Financeira do Plano
          </p>

          <div className="space-y-1.5">
            {hasSessoes && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pacotes / procedimentos avulsos:</span>
                <span className="font-semibold">{fmtCur(totalSessoes)}</span>
              </div>
            )}
            {hasMensal && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Mensalidades (recorrente):</span>
                <span className="font-semibold">
                  {fmtCur(totalMensal)}
                  <span className="text-xs font-normal text-muted-foreground">/mês</span>
                </span>
              </div>
            )}
            {totalSessions > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total de sessões previstas:</span>
                <span className="font-semibold">{totalSessions} sessões</span>
              </div>
            )}
            {estimatedWeeks > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Duração estimada do plano:</span>
                <span className="font-semibold">
                  {estimatedWeeks} {estimatedWeeks === 1 ? "semana" : "semanas"}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    (~{(estimatedWeeks / 4.33).toFixed(1)} meses)
                  </span>
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-1.5 border-t border-primary/20">
              <span className="text-slate-700 font-semibold">
                {hasMensal && hasSessoes ? "Total na contratação:" : hasSessoes ? "Total do plano:" : "Investimento mensal:"}
              </span>
              <span className="font-bold text-primary">
                {hasSessoes && hasMensal
                  ? fmtCur(totalSessoes + totalMensal)
                  : hasSessoes
                  ? fmtCur(totalSessoes)
                  : <>{fmtCur(totalMensal)}<span className="text-xs font-normal text-muted-foreground">/mês</span></>}
              </span>
            </div>
          </div>

          {/* Monthly plan rules */}
          {hasMensal && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 space-y-1">
              <p className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Regras do Plano Mensal
              </p>
              {planItems.filter(i => i.packageType === "mensal").map(item => (
                <div key={item.id} className="text-[10px] text-emerald-700 flex items-start gap-1">
                  <span className="mt-0.5">•</span>
                  <span>
                    <strong>{item.packageName ?? item.procedureName}</strong>: valor fixo de {fmtCur(item.monthlyPrice)}/mês, 
                    {" "}{item.sessionsPerWeek}x/semana (~{item.sessionsPerWeek * 4} sessões/mês).
                    {(item.absenceCreditLimit ?? 0) > 0
                      ? ` Crédito de até ${item.absenceCreditLimit} falta(s)/mês — cobrado mesmo com ausências dentro do limite.`
                      : " Sem crédito de faltas."}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hasMensal && (
            <p className="text-[10px] text-slate-500 flex gap-1 items-start">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              Mensalidades são recorrentes. O total acima considera apenas o 1º mês de cobrança.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Treatment Plan Tab ─────────────────────────────────────────────────────────

function TreatmentPlanTab({ patientId, patient }: { patientId: number; patient?: PatientBasic }) {
  const { data, isLoading } = useGetTreatmentPlan(patientId);
  const mutation = useSaveTreatmentPlan();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/appointments`],
    queryFn: () => fetch(`/api/patients/${patientId}/appointments`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` }
    }).then(r => r.json()),
    enabled: !!patientId,
  });

  const completedAppts = [...appointments]
    .filter((a: any) => a.status === "concluido")
    .sort((a: any, b: any) =>
      new Date(b.date + "T" + (b.startTime || "00:00")).getTime() -
      new Date(a.date + "T" + (a.startTime || "00:00")).getTime()
    );
  const completedSessions = completedAppts.length;

  const [form, setForm] = useState({
    objectives: "", techniques: "", frequency: "",
    estimatedSessions: "" as string | number,
    status: "ativo" as "ativo" | "concluido" | "suspenso",
  });

  useEffect(() => {
    if (data) {
      setForm({
        objectives: data.objectives || "",
        techniques: data.techniques || "",
        frequency: data.frequency || "",
        estimatedSessions: data.estimatedSessions || "",
        status: (data.status as "ativo" | "concluido" | "suspenso") || "ativo",
      });
    }
  }, [data]);

  const handleSave = () => {
    mutation.mutate({
      patientId,
      data: { ...form, estimatedSessions: form.estimatedSessions ? Number(form.estimatedSessions) : undefined },
    }, {
      onSuccess: () => {
        toast({ title: "Salvo com sucesso", description: "Plano de tratamento atualizado." });
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/treatment-plan`] });
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  const statusStyles = {
    ativo: "bg-green-100 text-green-700",
    concluido: "bg-slate-100 text-slate-700",
    suspenso: "bg-orange-100 text-orange-700",
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-xl">Plano de Tratamento</CardTitle>
            <CardDescription>Objetivos, técnicas e frequência do tratamento</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[form.status]}`}>
              {form.status === "ativo" ? "Ativo" : form.status === "concluido" ? "Concluído" : "Suspenso"}
            </span>
            {patient && (
              <Button variant="outline" size="sm" className="h-8 px-3 rounded-xl text-xs gap-1.5"
                onClick={() => printDocument(generatePlanHTML(patient, form, appointments), `Plano de Tratamento — ${patient.name}`)}>
                <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Objetivos do Tratamento
          </Label>
          <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })}
            placeholder="Quais os objetivos terapêuticos a serem alcançados..." />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" /> Técnicas e Recursos
          </Label>
          <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.techniques} onChange={e => setForm({ ...form, techniques: e.target.value })}
            placeholder="Técnicas fisioterapêuticas, eletroterapia, exercícios..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Frequência das Sessões</Label>
            <Input className="bg-slate-50 border-slate-200 focus:bg-white"
              value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
              placeholder="Ex: 3x por semana, quinzenal..." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Sessões Estimadas</Label>
            <Input type="number" min={1} className="bg-slate-50 border-slate-200 focus:bg-white"
              value={form.estimatedSessions} onChange={e => setForm({ ...form, estimatedSessions: e.target.value })}
              placeholder="Ex: 20" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Status do Tratamento</Label>
          <Select value={form.status} onValueChange={(v: "ativo" | "concluido" | "suspenso") => setForm({ ...form, status: v })}>
            <SelectTrigger className="bg-slate-50 border-slate-200 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Session progress */}
        {(form.estimatedSessions || completedSessions > 0) && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Progresso de Sessões
              </Label>
              <span className={`text-sm font-bold ${
                form.estimatedSessions && completedSessions >= Number(form.estimatedSessions)
                  ? "text-green-600"
                  : "text-primary"
              }`}>
                {completedSessions} / {form.estimatedSessions || "—"}
              </span>
            </div>
            {form.estimatedSessions ? (
              <>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      completedSessions >= Number(form.estimatedSessions)
                        ? "bg-green-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, (completedSessions / Number(form.estimatedSessions)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {completedSessions >= Number(form.estimatedSessions)
                    ? "Meta atingida! Considere registrar a alta."
                    : `${Math.max(0, Number(form.estimatedSessions) - completedSessions)} sessão(ões) restante(s)`}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400">{completedSessions} sessão(ões) concluída(s). Defina o total estimado para ver o progresso.</p>
            )}
          </div>
        )}

        {/* Últimas sessões concluídas */}
        {completedAppts.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              Últimas sessões concluídas
            </p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {completedAppts.slice(0, 10).map((a: any, i: number) => (
                <div key={a.id} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-lg text-xs border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {completedAppts.length - i}
                  </span>
                  <span className="font-medium text-slate-700">{formatDate(a.date)}</span>
                  {a.startTime && <span className="text-slate-400">{a.startTime}</span>}
                  <span className="text-slate-500 ml-auto truncate max-w-[120px]">{a.procedure?.name || "Sessão"}</span>
                </div>
              ))}
            </div>
            {completedAppts.length > 10 && (
              <p className="text-xs text-slate-400 text-center">+{completedAppts.length - 10} sessão(ões) anteriores</p>
            )}
          </div>
        )}

        <TreatmentPlanItemsSection planId={data?.id} patientId={patientId} />

        <div className="pt-3 flex justify-end">
          <Button onClick={handleSave} className="h-11 px-8 rounded-xl shadow-md shadow-primary/20" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Plano
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Evolutions Tab ─────────────────────────────────────────────────────────────

const emptyEvoForm = { appointmentId: "" as string | number, description: "", patientResponse: "", clinicalNotes: "", complications: "" };

function EvolutionsTab({ patientId, patient }: { patientId: number; patient?: PatientBasic }) {
  const { data: evolutions = [], isLoading } = useListEvolutions(patientId);
  const createMutation = useCreateEvolution();
  const updateMutation = useUpdateEvolution();
  const deleteMutation = useDeleteEvolution();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyEvoForm);

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/appointments`],
    queryFn: () => fetch(`/api/patients/${patientId}/appointments`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` }
    }).then(r => r.json()),
    enabled: !!patientId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/evolutions`] });

  const sortedApptsByDate = [...appointments].sort((a: any, b: any) =>
    new Date(a.date + "T" + (a.startTime || "00:00")).getTime() -
    new Date(b.date + "T" + (b.startTime || "00:00")).getTime()
  );

  const getSessionNumber = (ev: any, fallbackIdx: number): number => {
    if (ev.appointmentId) {
      const pos = sortedApptsByDate.findIndex((a: any) => a.id === ev.appointmentId);
      if (pos !== -1) return pos + 1;
    }
    return evolutions.length - fallbackIdx;
  };

  const buildPayload = () => ({
    ...form,
    appointmentId: form.appointmentId ? Number(form.appointmentId) : undefined,
  });

  const handleCreate = () => {
    createMutation.mutate({ patientId, data: buildPayload() }, {
      onSuccess: () => {
        toast({ title: "Evolução registrada", description: "Anotação de evolução salva com sucesso." });
        invalidate();
        setForm(emptyEvoForm);
        setShowForm(false);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  const handleUpdate = (id: number) => {
    updateMutation.mutate({ patientId, evolutionId: id, data: buildPayload() }, {
      onSuccess: () => {
        toast({ title: "Evolução atualizada", description: "Alterações salvas com sucesso." });
        invalidate();
        setEditingId(null);
        setForm(emptyEvoForm);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Excluir esta evolução permanentemente?")) return;
    deleteMutation.mutate({ patientId, evolutionId: id }, {
      onSuccess: () => { toast({ title: "Evolução excluída" }); invalidate(); },
      onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });
  };

  const startEdit = (ev: any) => {
    setEditingId(ev.id);
    setShowForm(false);
    setForm({
      appointmentId: ev.appointmentId || "",
      description: ev.description || "",
      patientResponse: ev.patientResponse || "",
      clinicalNotes: ev.clinicalNotes || "",
      complications: ev.complications || "",
    });
  };

  const EvoForm = ({ onSave, onCancel, saving, title }: { onSave: () => void; onCancel: () => void; saving: boolean; title: string }) => (
    <Card className="border-2 border-primary/20 shadow-md">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Consulta Vinculada <span className="text-slate-400 font-normal">(opcional)</span></Label>
          <Select
            value={String(form.appointmentId || "")}
            onValueChange={v => setForm({ ...form, appointmentId: v === "none" ? "" : v })}
          >
            <SelectTrigger className="bg-slate-50 border-slate-200">
              <SelectValue placeholder="Selecionar consulta..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma consulta vinculada</SelectItem>
              {appointments.map((appt: any) => (
                <SelectItem key={appt.id} value={String(appt.id)}>
                  {formatDate(appt.date)} — {appt.startTime} — {appt.procedure?.name || "Consulta"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Descrição da Sessão</Label>
          <Textarea className="min-h-[90px] bg-slate-50 border-slate-200 resize-none text-sm"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="O que foi realizado na sessão de hoje..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Resposta do Paciente</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 resize-none text-sm"
              value={form.patientResponse} onChange={e => setForm({ ...form, patientResponse: e.target.value })}
              placeholder="Como o paciente respondeu ao tratamento..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Notas Clínicas</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 resize-none text-sm"
              value={form.clinicalNotes} onChange={e => setForm({ ...form, clinicalNotes: e.target.value })}
              placeholder="Observações clínicas relevantes..." />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Intercorrências</Label>
          <Textarea className="min-h-[70px] bg-slate-50 border-slate-200 resize-none text-sm"
            value={form.complications} onChange={e => setForm({ ...form, complications: e.target.value })}
            placeholder="Alguma intercorrência ou evento adverso..." />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancelar</Button>
          <Button onClick={onSave} className="rounded-xl" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Evolução
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Evoluções de Sessão</h3>
          <p className="text-sm text-slate-500">{evolutions.length} evolução(ões) registrada(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {patient && evolutions.length > 0 && (
            <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl text-xs gap-1.5"
              onClick={() => printDocument(generateEvolutionsHTML(patient, evolutions, appointments), `Evoluções — ${patient.name}`)}>
              <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
            </Button>
          )}
          <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyEvoForm); }} className="h-10 px-5 rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Nova Evolução
          </Button>
        </div>
      </div>

      {showForm && !editingId && (
        <EvoForm
          title="Registrar Evolução de Sessão"
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm(emptyEvoForm); }}
          saving={createMutation.isPending}
        />
      )}

      {evolutions.length === 0 && !showForm ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-12 text-center text-slate-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma evolução registrada</p>
            <p className="text-sm mt-1">Registre evoluções após cada sessão.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />
          <div className="space-y-4">
            {evolutions.map((ev, idx) => {
              const linkedAppt = appointments.find((a: any) => a.id === ev.appointmentId);
              const sessionNum = getSessionNumber(ev, idx);
              return (
                <div key={ev.id} className="relative flex gap-4 pl-10">
                  <div className="absolute left-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-md z-10">
                    {sessionNum}
                  </div>
                  {editingId === ev.id ? (
                    <div className="flex-1">
                      <EvoForm
                        title={`Editar Sessão #${sessionNum}`}
                        onSave={() => handleUpdate(ev.id)}
                        onCancel={() => { setEditingId(null); setForm(emptyEvoForm); }}
                        saving={updateMutation.isPending}
                      />
                    </div>
                  ) : (
                    <Card className="flex-1 border border-slate-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-xs text-slate-400 font-medium">{formatDateTime(ev.createdAt)}</p>
                            {linkedAppt && (
                              <p className="text-xs text-primary font-medium mt-0.5">
                                📅 Consulta: {formatDate(linkedAppt.date)} — {linkedAppt.startTime} — {linkedAppt.procedure?.name || "Consulta"}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-primary"
                              onClick={() => startEdit(ev)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                              onClick={() => handleDelete(ev.id)} disabled={deleteMutation.isPending}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {ev.description && <InfoBlock label="Sessão" value={ev.description} className="md:col-span-2" />}
                          {ev.patientResponse && <InfoBlock label="Resposta do Paciente" value={ev.patientResponse} />}
                          {ev.clinicalNotes && <InfoBlock label="Notas Clínicas" value={ev.clinicalNotes} />}
                          {ev.complications && <InfoBlock label="Intercorrências" value={ev.complications} className="md:col-span-2" />}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Audit Log Section ───────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, { label: string; icon: string }> = {
  anamnesis:      { label: "Anamnese",              icon: "📋" },
  evaluation:     { label: "Avaliação Física",       icon: "🔍" },
  evolution:      { label: "Evolução de Sessão",     icon: "📈" },
  discharge:      { label: "Alta Fisioterapêutica",  icon: "✅" },
  treatment_plan: { label: "Plano de Tratamento",    icon: "🎯" },
  financial:      { label: "Financeiro",             icon: "💰" },
  attachment:     { label: "Exame / Anexo",          icon: "📎" },
  atestado:       { label: "Atestado",               icon: "📄" },
  patient:        { label: "Cadastro do Paciente",   icon: "👤" },
};

const ACTION_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  create: { label: "Criado",   bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  update: { label: "Editado",  bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400"    },
  delete: { label: "Excluído", bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400"     },
};

function AuditLogSection({ patientId }: { patientId: number }) {
  const [open, setOpen] = useState(false);
  const token = () => localStorage.getItem("fisiogest_token");
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/audit-log/patients/${patientId}`],
    queryFn: () => fetch(`/api/audit-log/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json()),
    enabled: !!patientId,
    staleTime: 30_000,
  });

  const recentCount = logs.length;

  return (
    <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
          <Lock className="w-3.5 h-3.5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700">Log de Auditoria do Prontuário</p>
          <p className="text-xs text-slate-500">
            {isLoading ? "Carregando…" : recentCount > 0 ? `${recentCount} registro(s) de alteração` : "Nenhuma alteração registrada"}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          )}
          {!isLoading && logs.length === 0 && (
            <p className="text-sm text-slate-400 py-5 text-center">
              Nenhuma alteração registrada ainda.
            </p>
          )}
          {!isLoading && logs.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {logs.map((log: any) => {
                const style = ACTION_STYLES[log.action] || ACTION_STYLES.update;
                const entity = ENTITY_LABELS[log.entityType] || { label: log.entityType, icon: "📝" };
                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="shrink-0 mt-0.5">
                      <span className="text-base">{entity.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                        <span className="text-xs font-semibold text-slate-800">{entity.label}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-snug">{log.summary || entity.label}</p>
                      {log.userName && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          por <span className="font-medium text-slate-500">{log.userName}</span>
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400 whitespace-nowrap mt-0.5">
                      {format(new Date(log.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Audit Log Tab (dedicated full view) ────────────────────────────────────────

type AuditAction = "all" | "create" | "update" | "delete";

function AuditLogTab({ patientId }: { patientId: number }) {
  const [filter, setFilter] = useState<AuditAction>("all");
  const token = () => localStorage.getItem("fisiogest_token");

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/audit-log/patients/${patientId}`],
    queryFn: () =>
      fetch(`/api/audit-log/patients/${patientId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      }).then((r) => r.json()),
    enabled: !!patientId,
    staleTime: 30_000,
  });

  const filtered = filter === "all" ? logs : logs.filter((l) => l.action === filter);

  const counts = {
    all: logs.length,
    create: logs.filter((l) => l.action === "create").length,
    update: logs.filter((l) => l.action === "update").length,
    delete: logs.filter((l) => l.action === "delete").length,
  };

  // Group by calendar date
  const grouped: Record<string, any[]> = {};
  for (const log of filtered) {
    const day = format(new Date(log.createdAt), "yyyy-MM-dd");
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(log);
  }
  const days = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function dayLabel(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) return "Hoje";
    if (format(d, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) return "Ontem";
    return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  const filterButtons: { key: AuditAction; label: string; color: string; activeClass: string }[] = [
    { key: "all",    label: `Todos (${counts.all})`,          color: "border-slate-200 text-slate-600", activeClass: "bg-slate-800 text-white border-slate-800" },
    { key: "create", label: `Criações (${counts.create})`,    color: "border-emerald-200 text-emerald-700", activeClass: "bg-emerald-600 text-white border-emerald-600" },
    { key: "update", label: `Edições (${counts.update})`,     color: "border-blue-200 text-blue-700",    activeClass: "bg-blue-600 text-white border-blue-600" },
    { key: "delete", label: `Exclusões (${counts.delete})`,   color: "border-red-200 text-red-600",      activeClass: "bg-red-600 text-white border-red-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Log de Auditoria do Prontuário</h3>
          <p className="text-sm text-slate-500">
            Rastreabilidade completa — todas as criações, edições e exclusões ficam registradas com usuário e horário.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Criações", value: counts.create, bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
          { label: "Edições",  value: counts.update, bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400"    },
          { label: "Exclusões",value: counts.delete, bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-400"     },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3 ${s.bg} flex items-center gap-2.5`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
            <div>
              <p className={`text-lg font-bold leading-none ${s.text}`}>{s.value}</p>
              <p className={`text-xs mt-0.5 ${s.text} opacity-80`}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              filter === btn.key ? btn.activeClass : `bg-white ${btn.color} hover:bg-slate-50`
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-12 text-center text-slate-400">
            <Lock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum registro encontrado</p>
            <p className="text-sm mt-1">
              {filter === "all"
                ? "Ainda não há ações registradas neste prontuário."
                : "Nenhum registro para o filtro selecionado."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {days.map((day) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {dayLabel(day)}
                </span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-300">{grouped[day].length}</span>
              </div>
              <div className="space-y-1">
                {grouped[day].map((log: any) => {
                  const style = ACTION_STYLES[log.action] || ACTION_STYLES.update;
                  const entity = ENTITY_LABELS[log.entityType] || { label: log.entityType, icon: "📝" };
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mt-0.5 text-sm">
                        {entity.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-semibold text-slate-800">{entity.label}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {style.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-snug">{log.summary || entity.label}</p>
                        {log.userName && (
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span className="font-medium text-slate-500">{log.userName}</span>
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400 whitespace-nowrap mt-0.5 tabular-nums">
                        {format(new Date(log.createdAt), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Appointment History Tab ────────────────────────────────────────────────────

function HistoryTab({ patientId, patient }: { patientId: number; patient: PatientBasic }) {
  const { data: appointments = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/appointments`],
    queryFn: () => fetch(`/api/patients/${patientId}/appointments`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` }
    }).then(r => r.json()),
    enabled: !!patientId,
  });
  const [dialogAppt, setDialogAppt] = useState<any | null>(null);

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-800">Histórico de Consultas</h3>
        <p className="text-sm text-slate-500">{appointments.length} consulta(s) registrada(s)</p>
      </div>

      {appointments.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-12 text-center text-slate-400">
            <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma consulta registrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt: any) => {
            const cfg = statusConfig[appt.status] || statusConfig.agendado;
            const isConcluido = appt.status === "concluido";
            return (
              <Card key={appt.id} className="border border-slate-200 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                    <span className="text-lg font-bold leading-none">{new Date(appt.date).getDate()}</span>
                    <span className="text-[10px] uppercase font-medium opacity-70">
                      {format(new Date(appt.date), "MMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{appt.procedure?.name || "Procedimento não informado"}</p>
                    <p className="text-sm text-slate-500">{appt.startTime} — {appt.endTime} &bull; {formatDate(appt.date)}</p>
                    {appt.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{appt.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isConcluido && (
                      <Button variant="outline" size="sm"
                        className="h-8 gap-1.5 text-xs border-slate-200 text-slate-600 hover:text-primary hover:border-primary"
                        onClick={() => setDialogAppt(appt)}>
                        <ScrollText className="w-3.5 h-3.5" /> Atestado
                      </Button>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AtestadoDialog
        open={!!dialogAppt}
        onClose={() => setDialogAppt(null)}
        patientId={patientId}
        patient={patient}
        appointmentDate={dialogAppt?.date}
        defaultType="comparecimento"
      />

      <AuditLogSection patientId={patientId} />
    </div>
  );
}

// ─── Financial Tab ──────────────────────────────────────────────────────────────

const emptyPayForm = { type: "receita" as "receita" | "despesa", amount: "", description: "", category: "" };

function txTypeLabel(transactionType: string | null | undefined): { label: string; color: string } {
  switch (transactionType) {
    case "cobrancaSessao": return { label: "Cobrança / Sessão", color: "border-blue-200 text-blue-700" };
    case "cobrancaMensal": return { label: "Mensalidade", color: "border-violet-200 text-violet-700" };
    case "usoCredito": return { label: "Uso de Crédito", color: "border-amber-200 text-amber-700" };
    case "creditoSessao": return { label: "Crédito Gerado", color: "border-teal-200 text-teal-700" };
    default: return { label: "Transação", color: "border-slate-200 text-slate-600" };
  }
}

function statusLabel(status: string | null | undefined): { label: string; dot: string } {
  switch (status) {
    case "pago": return { label: "Pago", dot: "bg-green-500" };
    case "cancelado": return { label: "Cancelado", dot: "bg-red-400" };
    default: return { label: "Pendente", dot: "bg-amber-400" };
  }
}

function subscriptionStatusStyle(status: string) {
  switch (status) {
    case "ativa": return "bg-green-50 text-green-700 border-green-200";
    case "pausada": return "bg-amber-50 text-amber-700 border-amber-200";
    default: return "bg-red-50 text-red-600 border-red-200";
  }
}

function SubscriptionsSection({ patientId }: { patientId: number }) {
  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: subscriptions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/financial/patients/${patientId}/subscriptions`],
    queryFn: () => fetch(`/api/financial/patients/${patientId}/subscriptions`, { headers: authHeader() }).then(r => r.json()),
    enabled: !!patientId,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ procedureId: "", startDate: "", billingDay: "", monthlyAmount: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const { data: procedures = [] } = useQuery<any[]>({
    queryKey: ["procedures", "all"],
    queryFn: () => fetch("/api/procedures", { headers: authHeader() }).then(r => r.json()),
  });

  const handleCreate = async () => {
    if (!form.procedureId || !form.startDate || !form.billingDay || !form.monthlyAmount) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ ...form, patientId, procedureId: parseInt(form.procedureId), billingDay: parseInt(form.billingDay), monthlyAmount: Number(form.monthlyAmount) }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Assinatura criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/financial/patients/${patientId}/subscriptions`] });
      setForm({ procedureId: "", startDate: "", billingDay: "", monthlyAmount: "", notes: "" });
      setShowForm(false);
    } catch {
      toast({ title: "Erro ao criar assinatura", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Status atualizado" });
      queryClient.invalidateQueries({ queryKey: [`/api/financial/patients/${patientId}/subscriptions`] });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-slate-800">Assinaturas / Mensalidades</h4>
          <p className="text-xs text-slate-500">{subscriptions.length} assinatura(s) vinculada(s)</p>
        </div>
        <Button size="sm" className="h-8 rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-3.5 h-3.5 mr-1" />{showForm ? "Cancelar" : "Nova Assinatura"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Procedimento *</Label>
                <Select value={form.procedureId} onValueChange={v => setForm(f => ({ ...f, procedureId: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {procedures.filter((p: any) => p.billingType === "mensal").map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Início *</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Valor Mensal (R$) *</Label>
                <Input type="number" step="0.01" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} placeholder="Ex: 350,00" className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Dia de Cobrança *</Label>
                <Input type="number" min="1" max="31" value={form.billingDay} onChange={e => setForm(f => ({ ...f, billingDay: e.target.value }))} placeholder="Ex: 5" className="text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional..." className="text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="rounded-xl" disabled={saving} onClick={handleCreate}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Criar Assinatura
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
      ) : subscriptions.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-8 text-center text-slate-400 text-sm">Nenhuma assinatura ativa para este paciente</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub: any) => (
            <Card key={sub.id} className="border border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">{sub.procedure?.name ?? "Procedimento"}</p>
                      <Badge variant="outline" className={`text-[10px] border ${subscriptionStatusStyle(sub.status)}`}>
                        {sub.status === "ativa" ? "Ativa" : sub.status === "pausada" ? "Pausada" : "Cancelada"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cobrança todo dia <strong>{sub.billingDay}</strong> · Valor: <strong>{formatCurrency(sub.monthlyAmount)}</strong>
                      {sub.startDate && ` · Desde ${format(parseISO(sub.startDate), "dd/MM/yyyy")}`}
                    </p>
                    {sub.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{sub.notes}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {sub.status === "ativa" && (
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" onClick={() => handleStatusChange(sub.id, "pausada")}>
                        Pausar
                      </Button>
                    )}
                    {sub.status === "pausada" && (
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" onClick={() => handleStatusChange(sub.id, "ativa")}>
                        Reativar
                      </Button>
                    )}
                    {sub.status !== "cancelada" && (
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px] text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleStatusChange(sub.id, "cancelada")}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreditsSection({ patientId }: { patientId: number }) {
  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` });
  const { data, isLoading } = useQuery<{ credits: any[]; totalAvailable: number }>({
    queryKey: [`/api/financial/patients/${patientId}/credits`],
    queryFn: () => fetch(`/api/financial/patients/${patientId}/credits`, { headers: authHeader() }).then(r => r.json()),
    enabled: !!patientId,
  });

  const credits = data?.credits ?? [];
  const totalAvailable = data?.totalAvailable ?? 0;
  const creditsWithBalance = credits.filter((c: any) => c.availableCount > 0);

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></div>;
  if (credits.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-slate-800">Créditos de Sessão</h4>
        <Badge className={`${totalAvailable > 0 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"} border-none text-xs font-semibold`}>
          {totalAvailable} crédito{totalAvailable !== 1 ? "s" : ""} disponível{totalAvailable !== 1 ? "eis" : ""}
        </Badge>
      </div>
      {creditsWithBalance.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum crédito disponível no momento.</p>
      ) : (
        <div className="space-y-1.5">
          {creditsWithBalance.map((credit: any) => (
            <div key={credit.id} className="flex items-center justify-between p-3 rounded-xl bg-teal-50 border border-teal-100">
              <div>
                <p className="text-sm font-semibold text-teal-800">{credit.procedure?.name ?? "Procedimento"}</p>
                <p className="text-xs text-teal-600">{credit.notes}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-teal-700">{credit.availableCount}</p>
                <p className="text-[10px] text-teal-500">crédito{credit.availableCount !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinancialTab({ patientId }: { patientId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` });

  const { data: records = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/financial`],
    queryFn: () => fetch(`/api/patients/${patientId}/financial`, { headers: authHeader() }).then(r => r.json()),
    enabled: !!patientId,
  });

  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState(emptyPayForm);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"history" | "subscriptions">("history");

  const handleRegisterPayment = async () => {
    if (!payForm.amount || !payForm.description) {
      toast({ title: "Preencha valor e descrição", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/financial/records", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ ...payForm, amount: Number(payForm.amount), patientId }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Registro salvo", description: "Transação registrada com sucesso." });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/financial`] });
      setPayForm(emptyPayForm);
      setShowPayForm(false);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  const paidRecords = records.filter((r: any) => r.type === "receita" && r.transactionType !== "usoCredito" && r.transactionType !== "creditoSessao");
  const totalReceitas = paidRecords.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalDespesas = records.filter((r: any) => r.type === "despesa").reduce((s: number, r: any) => s + Number(r.amount), 0);
  const pendingCount = records.filter((r: any) => r.status === "pendente" && r.type === "receita").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Financeiro do Paciente</h3>
          <p className="text-sm text-slate-500">{records.length} transação(ões) · {pendingCount} pendente(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setActiveSection("history")}
              className={`px-3 h-8 transition-colors ${activeSection === "history" ? "bg-primary text-white" : "hover:bg-slate-50 text-slate-600"}`}
            >
              Histórico
            </button>
            <button
              onClick={() => setActiveSection("subscriptions")}
              className={`px-3 h-8 transition-colors border-l border-slate-200 ${activeSection === "subscriptions" ? "bg-primary text-white" : "hover:bg-slate-50 text-slate-600"}`}
            >
              Assinaturas
            </button>
          </div>
          {activeSection === "history" && (
            <Button
              onClick={() => { setShowPayForm(!showPayForm); setPayForm(emptyPayForm); }}
              className="h-8 px-3 rounded-xl text-xs"
              variant={showPayForm ? "outline" : "default"}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {showPayForm ? "Cancelar" : "Registrar"}
            </Button>
          )}
        </div>
      </div>

      {activeSection === "subscriptions" ? (
        <div className="space-y-6">
          <SubscriptionsSection patientId={patientId} />
          <CreditsSection patientId={patientId} />
        </div>
      ) : (
        <div className="space-y-4">
          {showPayForm && (
            <Card className="border-2 border-primary/20 shadow-md">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" /> Nova Transação Manual
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700">Tipo</Label>
                    <Select value={payForm.type} onValueChange={(v: "receita" | "despesa") => setPayForm({ ...payForm, type: v })}>
                      <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">Receita (pagamento recebido)</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700">Valor (R$) <span className="text-red-500">*</span></Label>
                    <Input type="number" min="0" step="0.01" className="bg-slate-50 border-slate-200 focus:bg-white" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Ex: 150.00" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-slate-700">Descrição <span className="text-red-500">*</span></Label>
                  <Input className="bg-slate-50 border-slate-200 focus:bg-white" value={payForm.description} onChange={e => setPayForm({ ...payForm, description: e.target.value })} placeholder="Ex: Pagamento de sessão, Avaliação inicial…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-slate-700">Categoria <span className="text-slate-400 font-normal">(opcional)</span></Label>
                  <Input className="bg-slate-50 border-slate-200 focus:bg-white" value={payForm.category} onChange={e => setPayForm({ ...payForm, category: e.target.value })} placeholder="Ex: Fisioterapia, Pilates…" />
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <Button variant="outline" onClick={() => setShowPayForm(false)} className="rounded-xl">Cancelar</Button>
                  <Button onClick={handleRegisterPayment} disabled={saving} className="rounded-xl">
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar Transação
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Card className="border-none bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Total Recebido</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(totalReceitas)}</p>
              </CardContent>
            </Card>
            <Card className="border-none bg-gradient-to-br from-red-50 to-rose-50 shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Total Despesas</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(totalDespesas)}</p>
              </CardContent>
            </Card>
            <Card className={`border-none shadow-sm ${pendingCount > 0 ? "bg-gradient-to-br from-amber-50 to-yellow-50" : "bg-gradient-to-br from-slate-50 to-slate-100"}`}>
              <CardContent className="p-4">
                <p className={`text-[10px] font-bold uppercase mb-1 ${pendingCount > 0 ? "text-amber-600" : "text-slate-600"}`}>Pendentes</p>
                <p className={`text-xl font-bold ${pendingCount > 0 ? "text-amber-700" : "text-slate-800"}`}>{pendingCount}</p>
              </CardContent>
            </Card>
          </div>

          {records.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200">
              <CardContent className="p-12 text-center text-slate-400">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhuma transação registrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {records.map((record: any) => {
                const txInfo = txTypeLabel(record.transactionType);
                const stInfo = statusLabel(record.status);
                const isCreditUse = record.transactionType === "usoCredito" || record.transactionType === "creditoSessao";
                return (
                  <Card key={record.id} className={`border shadow-sm ${isCreditUse ? "border-teal-100 bg-teal-50/30" : "border-slate-200"}`}>
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCreditUse ? "bg-teal-100" : record.type === "receita" ? "bg-green-100" : "bg-red-100"}`}>
                        <DollarSign className={`w-4 h-4 ${isCreditUse ? "text-teal-600" : record.type === "receita" ? "text-green-600" : "text-red-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{record.description}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {record.transactionType && (
                            <Badge variant="outline" className={`text-[9px] border ${txInfo.color} py-0`}>{txInfo.label}</Badge>
                          )}
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span className={`w-1.5 h-1.5 rounded-full ${stInfo.dot}`} />{stInfo.label}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatDateTime(record.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isCreditUse ? "text-teal-600" : record.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                          {isCreditUse ? "—" : record.type === "receita" ? "+" : "-"}{isCreditUse ? "Crédito" : formatCurrency(record.amount)}
                        </p>
                        {record.dueDate && (
                          <p className="text-[10px] text-slate-400">
                            Venc. {format(parseISO(record.dueDate), "dd/MM")}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Discharge Tab ──────────────────────────────────────────────────────────────

const DISCHARGE_REASONS = [
  "Objetivo alcançado",
  "Alta a pedido do paciente",
  "Encaminhamento para outro serviço",
  "Abandono de tratamento",
  "Sem resposta ao tratamento",
  "Outro",
];

function DischargeTab({ patientId, patient }: { patientId: number; patient?: PatientBasic }) {
  const { data, isLoading } = useGetDischarge(patientId);
  const { user } = useAuth();
  const mutation = useSaveDischarge();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ dischargeDate: today, dischargeReason: "", achievedResults: "", recommendations: "" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        dischargeDate: data.dischargeDate || today,
        dischargeReason: data.dischargeReason || "",
        achievedResults: data.achievedResults || "",
        recommendations: data.recommendations || "",
      });
    }
  }, [data]);

  const showForm = (!data && !isLoading) || editing;

  const handleSave = () => {
    if (!form.dischargeReason || !form.dischargeDate) return;
    mutation.mutate({ patientId, data: form }, {
      onSuccess: () => {
        toast({ title: "Alta registrada", description: "Documento de alta fisioterapêutica salvo com sucesso." });
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/discharge-summary`] });
        setEditing(false);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Alta Fisioterapêutica</h3>
          <p className="text-sm text-slate-500">Exigência regulatória COFFITO — finalização formal do tratamento</p>
        </div>
        {data && !editing && (
          <div className="flex items-center gap-2">
            {patient && (
              <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl text-xs gap-1.5"
                onClick={() => printDocument(
                  generateDischargeHTML(patient, data as unknown as Record<string, string>, { name: (user as any)?.name }),
                  `Alta Fisioterapêutica — ${patient.name}`
                )}>
                <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(true)} className="h-9 px-4 rounded-xl text-sm">
              Editar Alta
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <span className="font-semibold">Requisito COFFITO:</span> Todo prontuário deve conter o documento de alta com motivo, resultados e recomendações para o paciente.
        </p>
      </div>

      {showForm ? (
        <Card className="border-2 border-primary/20 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <LogOut className="w-4 h-4 text-primary" />
              {data ? "Editar Alta Fisioterapêutica" : "Registrar Alta Fisioterapêutica"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Data da Alta <span className="text-red-500">*</span></Label>
              <DatePickerPTBR value={form.dischargeDate} onChange={v => setForm({ ...form, dischargeDate: v })} className="bg-slate-50 border-slate-200 max-w-xs" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Motivo da Alta <span className="text-red-500">*</span></Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {DISCHARGE_REASONS.map(r => (
                  <button key={r} type="button"
                    onClick={() => setForm({ ...form, dischargeReason: r })}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.dischargeReason === r
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
              <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none text-sm"
                value={form.dischargeReason}
                onChange={e => setForm({ ...form, dischargeReason: e.target.value })}
                placeholder="Selecione uma opção acima ou descreva o motivo da alta..." />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Resultados Alcançados</Label>
              <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
                value={form.achievedResults} onChange={e => setForm({ ...form, achievedResults: e.target.value })}
                placeholder="Descreva a evolução funcional, redução de dor, ganhos de amplitude e força muscular..." />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Recomendações ao Paciente</Label>
              <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
                value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })}
                placeholder="Orientações pós-alta: exercícios domiciliares, cuidados posturais, retorno se necessário..." />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              {editing && (
                <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl">Cancelar</Button>
              )}
              <Button onClick={handleSave}
                disabled={mutation.isPending || !form.dischargeReason || !form.dischargeDate}
                className="h-11 px-8 rounded-xl shadow-md shadow-primary/20">
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                Registrar Alta
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : data ? (
        <Card className="border-none shadow-md overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-green-400 to-emerald-500" />
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-800">Alta Concedida</CardTitle>
                  <p className="text-xs text-slate-500">
                    {formatDate(data.dischargeDate)} &bull; Registrado em {formatDateTime(data.updatedAt)}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                <CheckCircle className="w-3.5 h-3.5" /> Alta Concedida
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <InfoBlock label="Motivo da Alta" value={data.dischargeReason} />
            {data.achievedResults && <InfoBlock label="Resultados Alcançados" value={data.achievedResults} />}
            {data.recommendations && <InfoBlock label="Recomendações ao Paciente" value={data.recommendations} />}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ─── Atestados ────────────────────────────────────────────────────────────────────

type AtestadoType = "comparecimento" | "afastamento" | "tratamento" | "personalizado";

type AtestadoRecord = {
  id: number;
  patientId: number;
  type: string;
  professionalName: string;
  professionalSpecialty: string | null;
  professionalCouncil: string | null;
  content: string;
  cid: string | null;
  daysOff: number | null;
  issuedAt: string;
};

const ATESTADO_TYPES: { value: AtestadoType; label: string; icon: React.ReactNode; activeClass: string; desc: string }[] = [
  { value: "comparecimento", label: "Comparecimento", icon: <CalendarDays className="w-4 h-4" />, activeClass: "border-blue-400 bg-blue-50 text-blue-700", desc: "Confirma presença na clínica" },
  { value: "afastamento",    label: "Afastamento",    icon: <BadgeCheck className="w-4 h-4" />,   activeClass: "border-red-400 bg-red-50 text-red-700",   desc: "Afastamento por período determinado" },
  { value: "tratamento",     label: "Tratamento",     icon: <ClipboardCheck className="w-4 h-4" />,activeClass: "border-green-500 bg-green-50 text-green-700",desc: "Declara tratamento em curso" },
  { value: "personalizado",  label: "Personalizado",  icon: <PenLine className="w-4 h-4" />,      activeClass: "border-slate-400 bg-slate-50 text-slate-700",desc: "Redigido livremente" },
];

const TYPE_BADGE: Record<string, string> = {
  comparecimento: "bg-blue-100 text-blue-700",
  afastamento: "bg-red-100 text-red-700",
  tratamento: "bg-green-100 text-green-700",
  personalizado: "bg-slate-100 text-slate-600",
};

const TYPE_LABEL: Record<string, string> = {
  comparecimento: "Comparecimento",
  afastamento: "Afastamento",
  tratamento: "Tratamento Contínuo",
  personalizado: "Personalizado",
};

function daysToWords(n: number): string {
  const map: Record<number, string> = {
    1:"um",2:"dois",3:"três",4:"quatro",5:"cinco",6:"seis",7:"sete",8:"oito",9:"nove",10:"dez",
    11:"onze",12:"doze",13:"treze",14:"quatorze",15:"quinze",16:"dezesseis",17:"dezessete",
    18:"dezoito",19:"dezenove",20:"vinte",21:"vinte e um",22:"vinte e dois",23:"vinte e três",
    24:"vinte e quatro",25:"vinte e cinco",26:"vinte e seis",27:"vinte e sete",28:"vinte e oito",
    29:"vinte e nove",30:"trinta",45:"quarenta e cinco",60:"sessenta",90:"noventa",
  };
  return map[n] ?? String(n);
}

function buildAtestadoTemplate({ type, name, cpf, age, dateStr, daysOff, purpose }: {
  type: AtestadoType; name: string; cpf: string; age?: number | null; dateStr: string; daysOff?: number; purpose?: string;
}): string {
  const ageText = age ? `, ${age} anos,` : "";
  const fmt = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (type === "comparecimento") {
    return `Atestamos para os devidos fins que o(a) Sr(a). ${name}${ageText} portador(a) do CPF nº ${fmt}, compareceu a esta clínica no dia ${dateStr} para realização de atendimento fisioterapêutico, conforme prescrição e necessidade clínica.`;
  }
  if (type === "afastamento") {
    const d = daysOff || 0;
    const dw = d ? `${d} (${daysToWords(d)})` : "__ (____)";
    return `Atestamos para os devidos fins que o(a) Sr(a). ${name}${ageText} portador(a) do CPF nº ${fmt}, necessita de afastamento de suas atividades laborais pelo período de ${dw} dias, a partir de ${dateStr}.\n\nEsta determinação baseia-se em avaliação clínica realizada nesta data, sendo imprescindível o repouso para recuperação adequada do quadro em tratamento.`;
  }
  if (type === "tratamento") {
    const p = purpose?.trim() ? `para ${purpose.trim()}` : "conforme protocolo clínico estabelecido";
    return `Declaramos que o(a) Sr(a). ${name}${ageText} portador(a) do CPF nº ${fmt}, está sob acompanhamento fisioterapêutico regular nesta clínica, sendo necessária a manutenção do tratamento ${p}.\n\nSolicitamos a compreensão dos responsáveis para a continuidade e regularidade das sessões, fundamentais para o sucesso do tratamento.`;
  }
  return "";
}

function escapeHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function printAtestado(at: AtestadoRecord) {
  const dateStr = format(new Date(at.issuedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Atestado</title><style>
@page{margin:2.5cm}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000;line-height:1.5}
.header{border-bottom:2px solid #222;padding-bottom:14px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-start}
.clinic-name{font-size:15pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px}
.clinic-sub{font-size:9pt;color:#555;margin-top:3px}
.doc-info{text-align:right;font-size:9pt;color:#555}
.doc-num{font-size:8pt;color:#999}
.doc-title{text-align:center;margin:36px 0 28px}
.doc-title h1{font-size:18pt;font-weight:bold;letter-spacing:6px;text-transform:uppercase;border-bottom:1px solid #000;display:inline-block;padding-bottom:4px}
.content{text-align:justify;line-height:2;font-size:12pt;white-space:pre-wrap;margin-bottom:16px}
.cid{font-size:10pt;color:#444;margin-top:8px}
.city-date{margin-top:48px;text-align:right;font-size:11pt}
.signature{margin-top:64px;text-align:center}
.sig-line{border-top:1px solid #000;width:300px;margin:0 auto 10px}
.sig-name{font-weight:bold;font-size:11pt}
.sig-detail{font-size:10pt;color:#333}
.footer{margin-top:48px;padding-top:10px;border-top:1px solid #ccc;font-size:7.5pt;color:#888;text-align:center}
</style></head><body>
<div class="header">
  <div><div class="clinic-name">FisioGest Pro</div><div class="clinic-sub">Clínica de Fisioterapia &amp; Saúde</div></div>
  <div class="doc-info"><div><strong>Emitido em:</strong> ${dateStr}</div><div class="doc-num">Nº ${String(at.id).padStart(5,"0")}</div></div>
</div>
<div class="doc-title"><h1>Atestado</h1></div>
<div class="content">${escapeHtml(at.content)}</div>
${at.cid ? `<div class="cid"><strong>CID-10:</strong> ${escapeHtml(at.cid)}</div>` : ""}
<div class="city-date">${dateStr}</div>
<div class="signature">
  <div class="sig-line"></div>
  <div class="sig-name">${escapeHtml(at.professionalName)}</div>
  ${at.professionalSpecialty ? `<div class="sig-detail">${escapeHtml(at.professionalSpecialty)}</div>` : ""}
  ${at.professionalCouncil ? `<div class="sig-detail">${escapeHtml(at.professionalCouncil)}</div>` : ""}
</div>
<div class="footer">Documento emitido via FisioGest Pro em ${dateStr} — Atestado nº ${String(at.id).padStart(5,"0")}</div>
</body></html>`;
  const w = window.open("","_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

interface AtestadoDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: number;
  patient: PatientBasic;
  onCreated?: () => void;
  appointmentDate?: string;
  defaultType?: AtestadoType;
}

function AtestadoDialog({ open, onClose, patientId, patient, onCreated, appointmentDate, defaultType }: AtestadoDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [type, setType] = useState<AtestadoType>(defaultType ?? "comparecimento");
  const [profSpecialty, setProfSpecialty] = useState(() => localStorage.getItem("fisiogest_prof_specialty") ?? "");
  const [profCouncil, setProfCouncil]     = useState(() => localStorage.getItem("fisiogest_prof_council") ?? "");
  const [daysOff, setDaysOff]   = useState("3");
  const [purpose, setPurpose]   = useState("");
  const [cid, setCid]           = useState("");
  const [content, setContent]   = useState("");
  const [saving, setSaving]     = useState(false);

  const age = patient.birthDate ? differenceInYears(new Date(), parseISO(patient.birthDate)) : null;
  const dateStr = appointmentDate
    ? format(parseISO(appointmentDate), "dd/MM/yyyy", { locale: ptBR })
    : format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  useEffect(() => {
    if (!open) return;
    setType(defaultType ?? "comparecimento");
    setDaysOff("3"); setPurpose(""); setCid("");
  }, [open, defaultType]);

  useEffect(() => {
    if (type === "personalizado") { setContent(""); return; }
    setContent(buildAtestadoTemplate({ type, name: patient.name, cpf: patient.cpf ?? "", age, dateStr, daysOff: parseInt(daysOff)||0, purpose }));
  }, [type, patient.name, patient.cpf, age, dateStr, daysOff, purpose]);

  const handleEmit = async () => {
    if (!content.trim()) {
      toast({ title: "Texto obrigatório", description: "Preencha o conteúdo do atestado.", variant: "destructive" });
      return;
    }
    setSaving(true);
    localStorage.setItem("fisiogest_prof_specialty", profSpecialty);
    localStorage.setItem("fisiogest_prof_council", profCouncil);
    try {
      const res = await fetch(`/api/patients/${patientId}/atestados`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` },
        body: JSON.stringify({
          type, content, cid: cid || null,
          professionalName: user?.name ?? "Profissional",
          professionalSpecialty: profSpecialty || null,
          professionalCouncil: profCouncil || null,
          daysOff: type === "afastamento" ? (parseInt(daysOff) || null) : null,
        }),
      });
      if (!res.ok) throw new Error();
      const saved: AtestadoRecord = await res.json();
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/atestados`] });
      toast({ title: "Atestado emitido com sucesso!" });
      printAtestado(saved);
      onCreated?.();
      onClose();
    } catch {
      toast({ title: "Erro ao emitir atestado", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <div className="flex flex-col max-h-[90dvh] overflow-hidden">
          <DialogHeader className="pb-4 border-b border-slate-100 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-primary" /> Emitir Atestado
            </DialogTitle>
            <DialogDescription>
              Paciente: <strong>{patient.name}</strong> &bull; CPF: {(patient.cpf ?? "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4")}
              {appointmentDate && <> &bull; Consulta: <strong>{format(parseISO(appointmentDate),"dd/MM/yyyy",{locale:ptBR})}</strong></>}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto p-6 space-y-5">
            {/* Type selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Tipo de Atestado</Label>
              <div className="grid grid-cols-2 gap-2">
                {ATESTADO_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${type === t.value ? t.activeClass : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                    <span className="mt-0.5 shrink-0">{t.icon}</span>
                    <div>
                      <p className="font-semibold text-sm leading-tight">{t.label}</p>
                      <p className="text-xs opacity-70 mt-0.5 leading-tight">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific fields */}
            {type === "afastamento" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Dias de afastamento <span className="text-red-400">*</span></Label>
                  <Input type="number" min={1} max={365} className="h-9 text-sm bg-slate-50"
                    value={daysOff} onChange={e => setDaysOff(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">CID-10 (opcional)</Label>
                  <Input className="h-9 text-sm bg-slate-50 uppercase" placeholder="Ex: M54.5"
                    value={cid} onChange={e => setCid(e.target.value.toUpperCase())} />
                </div>
              </div>
            )}
            {type === "tratamento" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Finalidade do tratamento</Label>
                <Input className="h-9 text-sm bg-slate-50" placeholder="Ex: reabilitação pós-operatória de joelho direito"
                  value={purpose} onChange={e => setPurpose(e.target.value)} />
              </div>
            )}
            {(type === "comparecimento" || type === "personalizado") && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">CID-10 (opcional)</Label>
                <Input className="h-9 text-sm bg-slate-50 max-w-xs uppercase" placeholder="Ex: M54.5"
                  value={cid} onChange={e => setCid(e.target.value.toUpperCase())} />
              </div>
            )}

            {/* Content */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">
                Texto do Atestado
                {type !== "personalizado" && <span className="ml-2 text-xs font-normal text-slate-400">preenchido automaticamente · editável</span>}
              </Label>
              <Textarea
                className="min-h-[140px] text-sm bg-slate-50 border-slate-200 resize-none font-serif leading-relaxed"
                placeholder={type === "personalizado" ? "Digite o texto completo do atestado..." : ""}
                value={content} onChange={e => setContent(e.target.value)}
              />
            </div>

            {/* Professional info */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dados do Profissional (salvos automaticamente)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Nome do profissional</Label>
                  <p className="text-sm font-semibold text-slate-700 h-9 flex items-center">{user?.name ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Conselho / Registro</Label>
                  <Input className="h-9 text-sm bg-white" placeholder="Ex: CREFITO-3 123456-F"
                    value={profCouncil} onChange={e => setProfCouncil(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-slate-500">Especialidade</Label>
                  <Input className="h-9 text-sm bg-white" placeholder="Ex: Fisioterapia Ortopédica e Esportiva"
                    value={profSpecialty} onChange={e => setProfSpecialty(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 px-6 pb-2 border-t border-slate-100 shrink-0">
            <Button variant="outline" onClick={onClose} className="h-10">Cancelar</Button>
            <Button onClick={handleEmit} disabled={saving} className="h-10 gap-2 min-w-[155px] shadow-md shadow-primary/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {saving ? "Emitindo..." : "Emitir e Imprimir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AtestadosTab({ patientId, patient }: { patientId: number; patient: PatientBasic }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: atestados = [], isLoading } = useQuery<AtestadoRecord[]>({
    queryKey: [`/api/patients/${patientId}/atestados`],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${patientId}/atestados`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` },
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/patients/${patientId}/atestados/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/atestados`] });
      toast({ title: "Atestado excluído" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-xl">Atestados</CardTitle>
            <CardDescription>Atestados e declarações emitidos para este paciente</CardDescription>
          </div>
          <Button onClick={() => setShowDialog(true)} className="gap-2 h-10 shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Emitir Atestado
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

        {!isLoading && atestados.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400">
            <ScrollText className="w-14 h-14 mb-4 opacity-15" />
            <p className="font-semibold text-base">Nenhum atestado emitido</p>
            <p className="text-sm mt-1 text-slate-400">Clique em "Emitir Atestado" ou acesse o histórico de consultas</p>
          </div>
        )}

        {!isLoading && atestados.length > 0 && (
          <div className="space-y-3">
            {atestados.map(at => (
              <div key={at.id} className="rounded-xl border border-slate-200 bg-white p-4 flex gap-4 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ScrollText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[at.type] ?? "bg-slate-100 text-slate-600"}`}>
                      {TYPE_LABEL[at.type] ?? at.type}
                    </span>
                    {at.daysOff && <span className="text-xs text-slate-500">{at.daysOff} dia(s)</span>}
                    {at.cid && <span className="text-xs text-slate-400">CID: {at.cid}</span>}
                    <span className="text-xs text-slate-400 ml-auto shrink-0">{formatDateTime(at.issuedAt)}</span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{at.content}</p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {at.professionalName}{at.professionalSpecialty ? ` · ${at.professionalSpecialty}` : ""}
                    {at.professionalCouncil ? ` · ${at.professionalCouncil}` : ""}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => printAtestado(at)}>
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </Button>
                  <Button variant="ghost" size="sm"
                    className="h-8 gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    disabled={deletingId === at.id} onClick={() => handleDelete(at.id)}>
                    {deletingId === at.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AtestadoDialog open={showDialog} onClose={() => setShowDialog(false)}
        patientId={patientId} patient={patient} />
    </Card>
  );
}

// ─── Edit Patient Dialog ─────────────────────────────────────────────────────────

interface PatientData {
  id: number;
  name: string;
  cpf: string;
  phone: string;
  email?: string | null;
  birthDate?: string | null;
  address?: string | null;
  profession?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
}

function EditPatientDialog({
  patient,
  open,
  onClose,
  onSaved,
}: {
  patient: PatientData;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { hasPermission, hasRole } = useAuth();
  const { toast } = useToast();
  const mutation = useUpdatePatient();
  const isAdmin = hasRole("admin");

  const [form, setForm] = useState({
    name: patient.name ?? "",
    cpf: patient.cpf ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    birthDate: patient.birthDate ?? "",
    address: patient.address ?? "",
    profession: patient.profession ?? "",
    emergencyContact: patient.emergencyContact ?? "",
    notes: patient.notes ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: patient.name ?? "",
        cpf: patient.cpf ?? "",
        phone: patient.phone ?? "",
        email: patient.email ?? "",
        birthDate: patient.birthDate ?? "",
        address: patient.address ?? "",
        profession: patient.profession ?? "",
        emergencyContact: patient.emergencyContact ?? "",
        notes: patient.notes ?? "",
      });
    }
  }, [open, patient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { id: patient.id, data: form },
      {
        onSuccess: () => {
          toast({ title: "Cadastro atualizado", description: "Os dados do paciente foram salvos com sucesso." });
          onSaved();
          onClose();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Não foi possível atualizar o cadastro.";
          toast({ variant: "destructive", title: "Erro ao salvar", description: msg });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[620px] border-none shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" /> Editar Cadastro
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {isAdmin
              ? "Todos os campos estão disponíveis para edição."
              : "Você pode editar dados de contato e informações pessoais."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Identidade (somente admin) ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Identificação
              {!isAdmin && (
                <span className="ml-2 inline-flex items-center gap-1 text-slate-300 normal-case tracking-normal font-normal">
                  <Lock className="w-3 h-3" /> restrito ao administrador
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Nome Completo *</Label>
                <Input
                  required
                  disabled={!isAdmin}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">CPF *</Label>
                <Input
                  required
                  disabled={!isAdmin}
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="h-10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* ── Contato ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Contato</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Telefone *</Label>
                <Input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-0000"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>
          </div>

          {/* ── Dados Pessoais ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Dados Pessoais</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Data de Nascimento</Label>
                <DatePickerPTBR
                  value={form.birthDate}
                  onChange={(v) => setForm({ ...form, birthDate: v })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Profissão</Label>
                <Input
                  value={form.profession}
                  onChange={(e) => setForm({ ...form, profession: e.target.value })}
                  placeholder="Ex: Professora"
                  className="h-10"
                />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Endereço</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Rua, número - Bairro - Cidade"
                className="h-10"
              />
            </div>
          </div>

          {/* ── Emergência + Notas ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Informações Adicionais</p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Contato de Emergência
                </Label>
                <Input
                  value={form.emergencyContact}
                  onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                  placeholder="Nome — Telefone — Parentesco"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observações clínicas ou administrativas relevantes..."
                  className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" className="h-10 px-8 rounded-xl shadow-md shadow-primary/20" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function PatientDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const patientId = Number(id);
  const { data: patient, isLoading, refetch } = useGetPatient(patientId);
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const deleteMutation = useDeletePatient();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canEdit = hasPermission("patients.update");
  const canDelete = hasPermission("patients.delete");

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: patientId },
      {
        onSuccess: () => {
          toast({ title: "Paciente excluído", description: "O cadastro foi removido permanentemente." });
          setLocation("/pacientes");
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erro ao excluir", description: "Não foi possível excluir o paciente." });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <AppLayout title="Carregando...">
        <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout title="Paciente não encontrado">
        <div className="flex flex-col items-center justify-center p-20 text-slate-400">
          <User className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-lg font-medium">Paciente não encontrado</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Prontuário do Paciente">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Dialogs */}
        {canEdit && (
          <EditPatientDialog
            patient={patient as PatientData}
            open={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
              refetch();
            }}
          />
        )}

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente e removerá <strong>{patient.name}</strong> e todos os seus dados clínicos. Esta operação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Sim, excluir permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <div className="h-28 bg-gradient-to-r from-primary to-primary/60" />
            <CardContent className="px-5 pb-5 pt-0 relative">
              <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center text-3xl font-bold text-primary border-4 border-white -mt-10 mb-3">
                {patient.name.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-foreground leading-tight">{patient.name}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mt-1 mb-4">
                Paciente Ativo
              </span>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" /> {patient.phone}
                </div>
                {patient.email && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" /> {patient.email}
                  </div>
                )}
                {patient.birthDate && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {formatDate(patient.birthDate)}
                      <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                        {differenceInYears(new Date(), parseISO(patient.birthDate))} anos
                      </span>
                    </span>
                  </div>
                )}
                {patient.address && (
                  <div className="flex items-start gap-2.5 text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /> {patient.address}
                  </div>
                )}
                {patient.profession && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <UserCheck className="w-4 h-4 text-slate-400 shrink-0" /> {patient.profession}
                  </div>
                )}
                {patient.emergencyContact && (
                  <div className="flex items-start gap-2.5 text-slate-600">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-amber-600 font-semibold uppercase leading-none mb-0.5">Contato de Emergência</p>
                      <p className="text-sm text-slate-700">{patient.emergencyContact}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Consultas</p>
                  <p className="text-2xl font-bold text-slate-800">{patient.totalAppointments || 0}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Total Gasto</p>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(patient.totalSpent || 0)}</p>
                </div>
              </div>
              {patient.cpf && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mb-0.5">CPF</p>
                  <p className="text-sm font-medium text-slate-700">{patient.cpf}</p>
                </div>
              )}
              {patient.notes && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] text-amber-700 font-semibold uppercase mb-0.5">Observações</p>
                  <p className="text-xs text-amber-800">{patient.notes}</p>
                </div>
              )}

              {/* ── Export PDF ── */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <ExportProntuarioButton patientId={patientId} patient={patient} />
              </div>

              {/* ── Action buttons ── */}
              {(canEdit || canDelete) && (
                <div className="mt-3 flex flex-col gap-2">
                  {canEdit && (
                    <Button
                      variant="outline"
                      className="w-full h-9 rounded-xl text-sm border-primary/30 text-primary hover:bg-primary/5 hover:border-primary"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Editar Cadastro
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="outline"
                      className="w-full h-9 rounded-xl text-sm border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir Paciente
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="anamnesis" className="w-full">
            <div className="mb-5 space-y-1">
              {/* Main 6 tabs — scrollable on mobile, 3-col grid on md+ */}
              <TabsList className="w-full bg-white p-1 rounded-xl shadow-sm border border-slate-200 h-auto flex flex-wrap gap-1">
                {[
                  { value: "anamnesis",   icon: <ClipboardList className="w-3.5 h-3.5 shrink-0" />, label: "Anamnese" },
                  { value: "evaluations", icon: <Activity className="w-3.5 h-3.5 shrink-0" />,      label: "Avaliações" },
                  { value: "treatment",   icon: <Target className="w-3.5 h-3.5 shrink-0" />,         label: "Plano Trat." },
                  { value: "evolutions",  icon: <TrendingUp className="w-3.5 h-3.5 shrink-0" />,     label: "Evoluções" },
                  { value: "history",     icon: <History className="w-3.5 h-3.5 shrink-0" />,        label: "Histórico" },
                  { value: "financial",   icon: <DollarSign className="w-3.5 h-3.5 shrink-0" />,     label: "Financeiro" },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-1 basis-[calc(33.33%-4px)] min-w-[90px] rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white text-xs py-2.5 flex items-center justify-center gap-1.5"
                  >
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* Atestados + Alta + Auditoria row */}
              <TabsList className="w-full bg-white p-1 rounded-xl shadow-sm border border-dashed border-slate-300 h-auto flex gap-1">
                <TabsTrigger
                  value="atestados"
                  className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white text-xs py-2 flex items-center justify-center gap-1.5 data-[state=inactive]:text-slate-500"
                >
                  <ScrollText className="w-3.5 h-3.5 shrink-0" /> Atestados
                </TabsTrigger>
                <TabsTrigger
                  value="discharge"
                  className="flex-1 rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white text-xs py-2 flex items-center justify-center gap-1.5 data-[state=inactive]:text-slate-500"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" /> Alta Fisioterapêutica
                </TabsTrigger>
                <TabsTrigger
                  value="auditoria"
                  className="flex-1 rounded-lg data-[state=active]:bg-slate-800 data-[state=active]:text-white text-xs py-2 flex items-center justify-center gap-1.5 data-[state=inactive]:text-slate-500"
                >
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Auditoria
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="anamnesis"><AnamnesisTab patientId={patientId} /></TabsContent>
            <TabsContent value="evaluations"><EvaluationsTab patientId={patientId} /></TabsContent>
            <TabsContent value="treatment"><TreatmentPlanTab patientId={patientId} patient={patient ? { name: patient.name, cpf: patient.cpf, birthDate: patient.birthDate, phone: patient.phone } : undefined} /></TabsContent>
            <TabsContent value="evolutions"><EvolutionsTab patientId={patientId} patient={patient ? { name: patient.name, cpf: patient.cpf, birthDate: patient.birthDate, phone: patient.phone } : undefined} /></TabsContent>
            <TabsContent value="history">
              <HistoryTab patientId={patientId} patient={patient ? { name: patient.name, cpf: patient.cpf || "", birthDate: patient.birthDate } : { name: "", cpf: "" }} />
            </TabsContent>
            <TabsContent value="financial"><FinancialTab patientId={patientId} /></TabsContent>
            <TabsContent value="atestados">
              <AtestadosTab patientId={patientId} patient={patient ? { name: patient.name, cpf: patient.cpf || "", birthDate: patient.birthDate } : { name: "", cpf: "" }} />
            </TabsContent>
            <TabsContent value="discharge">
              <DischargeTab patientId={patientId} patient={patient ? { name: patient.name, cpf: patient.cpf, birthDate: patient.birthDate, phone: patient.phone } : undefined} />
            </TabsContent>
            <TabsContent value="auditoria">
              <AuditLogTab patientId={patientId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
