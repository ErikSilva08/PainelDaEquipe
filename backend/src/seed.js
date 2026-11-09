// Dados iniciais de exemplo. Apague backend/data/db.json para recriá-los
// ou chame POST /api/reset.

function at(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function createSeed() {
  const now = new Date().toISOString();

  const members = [
    { id: 'm_ana', name: 'Ana Ribeiro', role: 'Desenvolvedora front-end', avatar: 0 },
    { id: 'm_bruno', name: 'Bruno Lima', role: 'Desenvolvedor back-end', avatar: 1 },
    { id: 'm_carla', name: 'Carla Souza', role: 'Suporte e implantação', avatar: 2 },
    { id: 'm_diego', name: 'Diego Alves', role: 'Desenvolvedor full-stack', avatar: 3 },
    { id: 'm_elis', name: 'Elis Martins', role: 'QA e revisão', avatar: 4 },
    { id: 'm_felipe', name: 'Felipe Costa', role: 'Líder técnico', avatar: 5 },
  ].map((m) => ({
    ...m,
    status: 'livre',
    statusNote: '',
    statusUntil: null,
    statusSince: now,
    currentTaskId: null,
  }));

  const t = (o) => ({
    description: '',
    requester: '',
    priority: 'media',
    assignees: [],
    stage: 'entrada',
    updates: [],
    reviewNote: '',
    createdAt: now,
    finishedAt: null,
    completedAt: null,
    ...o,
  });

  const tasks = [
    t({
      id: 't_1001', code: 'CH-1001',
      title: 'Erro ao emitir nota fiscal no módulo financeiro',
      description: 'Cliente relata erro 500 ao emitir NF-e com mais de 20 itens. Reproduzir em homologação, corrigir e validar com o cliente.',
      client: 'Mercado Bom Preço', requester: 'Josefa (financeiro)',
      priority: 'urgente', dueDate: at(0, 17),
      assignees: ['m_bruno'], stage: 'andamento',
      updates: [{ id: 'u1', memberId: 'm_bruno', text: 'Reproduzido em homologação. O problema está no cálculo de impostos em lote.', at: now, kind: 'nota' }],
    }),
    t({
      id: 't_1002', code: 'CH-1002',
      title: 'Nova tela de relatório de vendas por vendedor',
      description: 'Filtros por período e vendedor, exportação para Excel e total por forma de pagamento.',
      client: 'Loja Dantas', requester: 'Gerência comercial',
      priority: 'alta', dueDate: at(2, 18),
      assignees: ['m_ana', 'm_diego'], stage: 'andamento',
    }),
    t({
      id: 't_1003', code: 'CH-1003',
      title: 'Treinamento do sistema para a equipe nova',
      description: 'Apresentação de 1h sobre cadastro de clientes e pedidos para 4 novos atendentes.',
      client: 'Clínica Vida', requester: 'RH',
      priority: 'media', dueDate: at(1, 14),
      assignees: ['m_carla'], stage: 'andamento',
    }),
    t({
      id: 't_1004', code: 'CH-1004',
      title: 'Ajustar layout do e-mail de recuperação de senha',
      description: 'Logo cortada no Outlook. Testar no Gmail, Outlook e celular.',
      client: 'Interno', requester: 'Felipe',
      priority: 'baixa', dueDate: at(3, 12),
      assignees: ['m_ana'], stage: 'revisao', finishedAt: now,
    }),
    t({
      id: 't_1005', code: 'CH-1005',
      title: 'Integração com gateway de pagamento PIX',
      description: 'Gerar QR Code dinâmico, receber webhook de confirmação e baixar o título automaticamente.',
      client: 'Mercado Bom Preço', requester: 'Diretoria',
      priority: 'alta', dueDate: at(5, 18),
    }),
    t({
      id: 't_1006', code: 'CH-1006',
      title: 'Usuário sem acesso ao módulo de estoque',
      description: 'Liberar permissão para o usuário "pedro.estoque" e conferir o perfil de acesso.',
      client: 'Loja Dantas', requester: 'Pedro',
      priority: 'media', dueDate: at(0, 16),
    }),
    t({
      id: 't_1007', code: 'CH-1007',
      title: 'Backup semanal não executou',
      description: 'Verificar o agendamento no servidor e os logs da última execução.',
      client: 'Interno', requester: 'Monitoramento',
      priority: 'alta', dueDate: at(1, 10),
    }),
    t({
      id: 't_1008', code: 'CH-1008',
      title: 'Atualizar dependências do aplicativo mobile',
      description: '',
      client: 'Interno', requester: 'Felipe',
      priority: 'baixa', dueDate: at(-2, 18), stage: 'concluida',
      assignees: ['m_diego'], finishedAt: at(-1, 15), completedAt: at(-1, 17),
    }),
  ];

  // Situação inicial para o escritório pixel ganhar vida
  const set = (id, patch) => Object.assign(members.find((m) => m.id === id), patch);
  set('m_bruno', { status: 'trabalhando', currentTaskId: 't_1001' });
  set('m_ana', { status: 'trabalhando', currentTaskId: 't_1002' });
  set('m_diego', { status: 'reuniao', statusNote: 'Alinhamento do relatório com o cliente' });
  set('m_carla', { status: 'externo', statusNote: 'Visita técnica na Clínica Vida', statusUntil: at(0, 16) });
  set('m_elis', { status: 'pausa', statusNote: 'Café' });

  return { members, tasks, seq: 1009 };
}
