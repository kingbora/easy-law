'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Result,
  Select,
  Space,
  Spin,
  Tag,
  Typography
} from 'antd';
import type { TrialStage, UserDepartment } from '@easy-law/shared-types';
import {
  DEPARTMENT_LABEL_MAP,
  DEFAULT_MENU_DATA_SOURCES,
  DEFAULT_TRIAL_STAGE_ORDER,
  TRIAL_STAGE_LABEL_MAP
} from '@easy-law/shared-types';

import { useMenuConfigStore } from '@/lib/stores/menu-config-store';
import { useSessionStore } from '@/lib/stores/session-store';
import { useDashboardHeaderAction } from '../header-context';

interface MenuConfigFormValues {
  dataSources: string[];
  trialStages: TrialStage[];
}

const DEPARTMENT_OPTIONS = (Object.entries(DEPARTMENT_LABEL_MAP) as Array<[UserDepartment, string]>).map(
  ([value, label]) => ({ value, label })
);

const TRIAL_STAGE_OPTIONS = (Object.entries(TRIAL_STAGE_LABEL_MAP) as Array<[TrialStage, string]>).map(
  ([value, label]) => ({ value, label })
);

function ensureDepartmentValue(
  user: ReturnType<typeof useSessionStore.getState>['user']
): UserDepartment | null {
  if (!user) {
    return null;
  }
  if (user.role === 'super_admin') {
    return null;
  }
  return user.department ?? null;
}

export default function MenuConfigPage() {
  const { message } = App.useApp();
  const currentUser = useSessionStore((state) => state.user);
  const [form] = Form.useForm<MenuConfigFormValues>();
  const [selectedDepartment, setSelectedDepartment] = useState<UserDepartment | null>(() =>
    ensureDepartmentValue(useSessionStore.getState().user)
  );
  const departmentConfig = useMenuConfigStore((state) =>
    selectedDepartment ? state.configs[selectedDepartment] : undefined
  );
  const departmentLoading = useMenuConfigStore((state) =>
    selectedDepartment ? state.loadingMap[selectedDepartment] ?? false : false
  );
  const departmentError = useMenuConfigStore((state) =>
    selectedDepartment ? state.errorMap[selectedDepartment] ?? null : null
  );
  const fetchConfig = useMenuConfigStore((state) => state.fetchConfig);
  const updateConfig = useMenuConfigStore((state) => state.updateConfig);

  const headerAction = useMemo(() => null, []);
  useDashboardHeaderAction(headerAction);

  useEffect(() => {
    if (!currentUser) {
      setSelectedDepartment(null);
      return;
    }
    if (currentUser.role === 'super_admin') {
      return;
    }
    setSelectedDepartment(currentUser.department ?? null);
  }, [currentUser]);

  useEffect(() => {
    if (!selectedDepartment) {
      form.resetFields();
      return;
    }
    void fetchConfig(selectedDepartment).catch(() => undefined);
  }, [form, fetchConfig, selectedDepartment]);

  useEffect(() => {
    if (!selectedDepartment) {
      form.resetFields();
      return;
    }
    const fallbackSources = departmentConfig?.dataSources ?? [...DEFAULT_MENU_DATA_SOURCES];
    const fallbackStages = departmentConfig?.trialStages ?? [...DEFAULT_TRIAL_STAGE_ORDER];
    form.setFieldsValue({
      dataSources: [...fallbackSources],
      trialStages: [...fallbackStages]
    });
  }, [departmentConfig, form, selectedDepartment]);

  const handleDepartmentChange = useCallback(
    (value: UserDepartment | null) => {
      setSelectedDepartment(value);
      form.resetFields();
    },
    [form]
  );

  const handleSubmit = useCallback(
    async (values: MenuConfigFormValues) => {
      if (!selectedDepartment) {
        message.warning('请选择要配置的部门');
        return;
      }
      try {
        await updateConfig(selectedDepartment, values);
        message.success('菜单配置已保存');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '保存失败，请稍后重试';
        message.error(errorMessage);
      }
    },
    [message, selectedDepartment, updateConfig]
  );

  const suggestedDataSources = useMemo(() => {
    const seeds = new Set<string>(DEFAULT_MENU_DATA_SOURCES);
    (departmentConfig?.dataSources ?? []).forEach((value) => {
      if (value) {
        seeds.add(value);
      }
    });
    return Array.from(seeds).map((value) => ({ value, label: value }));
  }, [departmentConfig?.dataSources]);

  const canAccess = currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'admin');
  const adminWithoutDepartment =
    currentUser?.role === 'admin' && (!currentUser.department || !selectedDepartment);

  if (!canAccess) {
    return (
      <Result status="403" title="无权访问" subTitle="仅管理员及以上角色可配置菜单数据" />
    );
  }

  if (adminWithoutDepartment) {
    return (
      <Result status="warning" title="未分配部门" subTitle="请联系超级管理员为当前账号分配所属部门后再进行配置" />
    );
  }

  const isFormDisabled = !selectedDepartment;
  const isLoading = Boolean(selectedDepartment && departmentLoading && !departmentConfig);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            菜单数据配置
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            配置各部门在案件信息中的数据来源和庭审阶段选项，帮助团队保持统一的数据录入标准。
          </Typography.Paragraph>
          {currentUser?.role === 'super_admin' ? (
            <Form layout="inline">
              <Form.Item label="选择部门" required>
                <Select<UserDepartment>
                  value={selectedDepartment ?? undefined}
                  placeholder="请选择要配置的部门"
                  options={DEPARTMENT_OPTIONS}
                  onChange={(value) => handleDepartmentChange((value as UserDepartment | undefined) ?? null)}
                  allowClear
                  style={{ minWidth: 200 }}
                />
              </Form.Item>
            </Form>
          ) : (
            <Space size={8} align="center">
              <Typography.Text type="secondary">当前部门：</Typography.Text>
              {selectedDepartment ? (
                <Tag color="blue">{DEPARTMENT_LABEL_MAP[selectedDepartment]}</Tag>
              ) : (
                <Tag>未分配</Tag>
              )}
            </Space>
          )}
          {departmentError ? <Alert type="error" message={departmentError} showIcon /> : null}
        </Space>
      </Card>

      <Card title="字段配置">
        <Spin spinning={isLoading}>
          <Form<MenuConfigFormValues>
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            disabled={isFormDisabled || isLoading}
          >
            <Form.Item
              label="数据来源下拉选项"
              name="dataSources"
              rules={[{ required: true, message: '请至少配置一个数据来源' }]}
              extra="这些选项将用于案件信息中的“数据来源”字段，输入新的选项后按回车即可添加。"
            >
              <Select
                mode="tags"
                placeholder="输入或选择数据来源"
                tokenSeparators={[',', '，', '、', ' ']}
                allowClear
                options={suggestedDataSources}
              />
            </Form.Item>

            <Form.Item
              label="庭审阶段下拉选项"
              name="trialStages"
              rules={[{ required: true, message: '请至少选择一个庭审阶段' }]}
              extra="按照选择顺序显示，通常建议保留从仲裁到再审的完整流程。"
            >
              <Select
                mode="multiple"
                placeholder="请选择可用的庭审阶段"
                options={TRIAL_STAGE_OPTIONS}
                allowClear
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" disabled={isFormDisabled} loading={departmentLoading}>
                保存配置
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </Space>
  );
}
