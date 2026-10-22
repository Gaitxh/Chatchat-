/** Safe, text-only UI for optional model-written, peer-reviewed council answers. */
export function renderSynthesisView({ meeting, state, actorName, node, pill, button }) {
  const wrap = node('section', 'synthesis-panel');
  wrap.setAttribute('aria-label', '综合答案与实际模型复核');
  const heading = node('div', 'synthesis-heading');
  heading.append(node('h3', '', '综合答案 · 同行复核'));
  const syn = meeting.synthesis;
  const stateLabels = {
    drafting: '正在执笔', reviewing: '交叉复核中',
    reviewed: '所有已邀请审查者均通过（不代表事实正确）',
    disputed: '保留不同意见', incomplete: '部分审查未完成',
    failed: '本次合成未完成', cancelled: '已停止',
    interrupted: '进程中断，未自动重试',
  };
  if (syn) {
    const tone = syn.status === 'reviewed' ? 'ready'
      : syn.status === 'disputed' || syn.status === 'incomplete' ? 'warning'
        : ['failed', 'cancelled', 'interrupted'].includes(syn.status) ? 'error' : 'muted';
    heading.append(pill(stateLabels[syn.status] || '记录中', tone));
  }
  wrap.append(heading);
  if (!syn) {
    wrap.append(node('p', 'synthesis-help',
      '现有报告已记录每个 AI 的实际最终立场。额外的综合答案必须由你明确发起：一席起草，其他可用席位交叉审查，不等于事实核验。'));
    if (state.synthesisAvailable) {
      wrap.append(button('生成复核答案 · 需额外模型调用', 'synthesizeMeeting', undefined, 'button primary-button'));
      wrap.append(node('p', 'secondary synthesis-note',
        '只在本次真实会议刚结束且原聊天仍有效时可用。历史回放不会重新连接或调用模型。'));
    } else {
      wrap.append(node('p', 'secondary synthesis-note',
        '此会议当前不能新增综合答案（可能来自历史记录、席位已变更或实际可用模型不足）。'));
    }
    return wrap;
  }
  if (syn.draft) {
    wrap.append(node('h4', 'synthesis-subheading', '执笔席草稿 · ' + actorName(state, syn.writerId)));
    wrap.append(node('p', 'synthesis-answer', syn.draft.answer));
    if (Array.isArray(syn.draft.caveats) && syn.draft.caveats.length) {
      const caveats = node('ul', 'synthesis-caveats');
      for (const item of syn.draft.caveats) caveats.append(node('li', '', item));
      wrap.append(caveats);
    }
    const citations = node('div', 'synthesis-citations');
    citations.append(node('strong', '', '对应会议发言（未核验外部事实）'));
    for (const id of syn.draft.eventIds || []) {
      const ref = button(String(id).slice(0, 60), 'viewEvent', id, 'button quiet synthesis-citation');
      ref.setAttribute('aria-label', '定位原始会议发言 ' + id);
      citations.append(ref);
    }
    wrap.append(citations);
  } else {
    wrap.append(node('p', 'synthesis-help',
      '等待执笔席提交合格的结构化答案。不会将超时、错误或格式不合法内容标记为有效答案。'));
  }
  if (syn.status === 'reviewing' && Array.isArray(syn.reviewerIds)) {
    wrap.append(node('p', 'synthesis-note',
      '已收到 ' + (syn.reviews?.length || 0) + ' / ' + syn.reviewerIds.length + ' 份实际审查回执。'));
  }
  if (Array.isArray(syn.reviews) && syn.reviews.length) {
    wrap.append(node('h4', 'synthesis-subheading', '独立审查回执'));
    for (const review of syn.reviews) {
      const card = node('div', 'synthesis-review');
      const title = node('div', 'synthesis-review-title');
      title.append(node('strong', '', actorName(state, review.participantId)));
      const labels = { approve: '赞成此草稿', revise: '要求修订', reject: '反对草稿' };
      title.append(pill(review.status === 'completed'
        ? labels[review.verdict] || '已审查' : '审查失败',
      review.status !== 'completed' ? 'error' : review.verdict === 'approve' ? 'ready' : 'warning'));
      card.append(title);
      card.append(node('p', '', review.commentary || review.error || '未取得可确认的审查结果'));
      if (Array.isArray(review.eventIds) && review.eventIds.length) {
        const sources = node('div', 'synthesis-citations');
        sources.append(node('strong', '', '审查关联的原始发言'));
        for (const id of review.eventIds) {
          const ref = button(String(id).slice(0, 60), 'viewEvent', id, 'button quiet synthesis-citation');
          ref.setAttribute('aria-label', '定位审查关联发言 ' + id);
          sources.append(ref);
        }
        card.append(sources);
      }
      wrap.append(card);
    }
  }
  if (syn.error) wrap.append(node('p', 'meeting-error', syn.error));
  wrap.append(node('p', 'synthesis-note',
    '这是模型之间实际生成与审查的结果，不是独立事实验证。只要有反对、缺席或不完整审查，就不会显示为全部通过。'));
  return wrap;
}
