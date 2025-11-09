import type { CaseTimeNodeType } from './cases-api';
import type { UserDepartment } from './users-api';

export interface CaseTimeNodeDefinition {
  type: CaseTimeNodeType;
  label: string;
  /**
   * 可用部门，如果未指定则对所有部门可见。
   */
  departments?: ReadonlyArray<UserDepartment>;
}

export const CASE_TIME_NODE_DEFINITIONS: ReadonlyArray<CaseTimeNodeDefinition> = [
  { type: 'apply_employment_confirmation', label: '申请确认劳动关系', departments: ['work_injury'] },
  { type: 'labor_arbitration_decision', label: '确认劳动裁决时间', departments: ['work_injury'] },
  { type: 'submit_injury_certification', label: '提交工伤认定申请', departments: ['work_injury'] },
  { type: 'receive_injury_certification', label: '收到工伤认定书', departments: ['work_injury'] },
  { type: 'submit_disability_assessment', label: '提交劳动能力等级鉴定', departments: ['work_injury'] },
  { type: 'receive_disability_assessment', label: '收到鉴定书', departments: ['work_injury'] },
  { type: 'apply_insurance_arbitration', label: '申请工伤保险待遇仲裁', departments: ['work_injury'] },
  { type: 'insurance_arbitration_decision', label: '工伤保险待遇裁决时间', departments: ['work_injury'] },
  { type: 'file_lawsuit', label: '起诉立案', departments: ['work_injury', 'insurance'] },
  { type: 'lawsuit_review_approved', label: '立案审核通过', departments: ['work_injury', 'insurance'] },
  { type: 'final_judgement', label: '裁决时间', departments: ['work_injury', 'insurance'] }
];

const isDefinitionSupported = (definition: CaseTimeNodeDefinition, department?: UserDepartment | null) => {
  if (!department || !definition.departments || definition.departments.length === 0) {
    return true;
  }
  return definition.departments.includes(department);
};

export const getCaseTimeNodeDefinitions = (department?: UserDepartment | null): ReadonlyArray<CaseTimeNodeDefinition> =>
  CASE_TIME_NODE_DEFINITIONS.filter((definition) => isDefinitionSupported(definition, department));

export const getCaseTimeNodeLabelMap = (
  department?: UserDepartment | null
): Record<CaseTimeNodeType, string> =>
  getCaseTimeNodeDefinitions(department).reduce<Record<CaseTimeNodeType, string>>((acc, definition) => {
    acc[definition.type] = definition.label;
    return acc;
  }, {} as Record<CaseTimeNodeType, string>);

export const getCaseTimeNodeOrderMap = (
  department?: UserDepartment | null
): Record<CaseTimeNodeType, number> =>
  getCaseTimeNodeDefinitions(department).reduce<Record<CaseTimeNodeType, number>>((acc, definition, index) => {
    acc[definition.type] = index;
    return acc;
  }, {} as Record<CaseTimeNodeType, number>);

export const CASE_TIME_NODE_LABEL_MAP = getCaseTimeNodeLabelMap();

export const CASE_TIME_NODE_ORDER_MAP = getCaseTimeNodeOrderMap();
