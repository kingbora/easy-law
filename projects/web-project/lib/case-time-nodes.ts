import type { CaseTimeNodeType } from './cases-api';

export interface CaseTimeNodeDefinition {
  type: CaseTimeNodeType;
  label: string;
}

export const CASE_TIME_NODE_DEFINITIONS: ReadonlyArray<CaseTimeNodeDefinition> = [
  { type: 'apply_employment_confirmation', label: '申请确认劳动关系' },
  { type: 'labor_arbitration_decision', label: '确认劳动裁决时间' },
  { type: 'submit_injury_certification', label: '提交工伤认定申请' },
  { type: 'receive_injury_certification', label: '收到工伤认定书' },
  { type: 'submit_disability_assessment', label: '提交劳动能力等级鉴定' },
  { type: 'receive_disability_assessment', label: '收到鉴定书' },
  { type: 'apply_insurance_arbitration', label: '申请工伤保险待遇仲裁' },
  { type: 'insurance_arbitration_decision', label: '工伤保险待遇裁决时间' },
  { type: 'file_lawsuit', label: '起诉立案' },
  { type: 'lawsuit_review_approved', label: '立案审核通过' },
  { type: 'final_judgement', label: '裁决时间' }
];

export const CASE_TIME_NODE_LABEL_MAP = CASE_TIME_NODE_DEFINITIONS.reduce<Record<CaseTimeNodeType, string>>(
  (acc, definition) => {
    acc[definition.type] = definition.label;
    return acc;
  },
  {} as Record<CaseTimeNodeType, string>
);

export const CASE_TIME_NODE_ORDER_MAP = CASE_TIME_NODE_DEFINITIONS.reduce<Record<CaseTimeNodeType, number>>(
  (acc, definition, index) => {
    acc[definition.type] = index;
    return acc;
  },
  {} as Record<CaseTimeNodeType, number>
);
