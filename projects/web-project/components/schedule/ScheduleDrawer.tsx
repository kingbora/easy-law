'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Badge,
  Button,
  Calendar,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  Space,
  Spin,
  Tag,
  TimePicker,
  Typography,
  message
} from 'antd';
import type { CalendarProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';

import styles from './ScheduleDrawer.module.scss';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  type CalendarEventRecord
} from '@/lib/calendar-events-api';
import { ApiError } from '@/lib/api-client';
import { useSessionStore } from '@/lib/stores/session-store';
import { useWorkInjuryCaseOperationsStore } from '@/components/cases/work-injury/operations/useCaseOperationsStore';

const { Title, Text } = Typography;

interface ScheduleDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface TodoFormValues {
  title?: string;
  time?: Dayjs;
}

const CUSTOM_EVENT_COLOR = '#52c41a';

const formatTrialStage = (stage: string | null | undefined) => {
  if (!stage) {
    return '未设置审理阶段';
  }
  const stageLabel: Record<string, string> = {
    first_instance: '一审',
    second_instance: '二审',
    retrial: '再审'
  };
  return stageLabel[stage] ?? stage;
};

const ScheduleDrawer = ({ open, onClose }: ScheduleDrawerProps) => {
  const sessionUser = useSessionStore((state) => state.user);
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs());
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todoForm] = Form.useForm<TodoFormValues>();
  const openWorkInjuryCaseDetail = useWorkInjuryCaseOperationsStore((state) => state.openCaseDetailExternally);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const result = await fetchCalendarEvents();
      setEvents(result);
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '获取日程数据失败，请稍后重试';
      message.error(errorMessage);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadEvents();
  }, [open, loadEvents]);

  useEffect(() => {
    if (open) {
      setCalendarValue(dayjs());
      todoForm.resetFields();
    }
  }, [open, todoForm]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>();
    events.forEach((event) => {
      const list = map.get(event.eventDate) ?? [];
      list.push(event);
      map.set(event.eventDate, list);
    });
    map.forEach((value, key) => {
      value.sort((a, b) => {
        const timeA = a.eventTime ?? '99:99';
        const timeB = b.eventTime ?? '99:99';
        const compare = timeA.localeCompare(timeB);
        if (compare !== 0) {
          return compare;
        }
        return a.createdAt.localeCompare(b.createdAt);
      });
      map.set(key, value);
    });
    return map;
  }, [events]);

  const selectedDate = calendarValue.format('YYYY-MM-DD');
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  const handleCalendarSelect: CalendarProps<Dayjs>['onSelect'] = (value) => {
    setCalendarValue(value);
  };

  const canCreateCustomEvent = useMemo(() => Boolean(sessionUser), [sessionUser]);

  const handleTodoSubmit = async (values: TodoFormValues) => {
    if (!values.time || !values.title) {
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: values.title.trim(),
        date: selectedDate,
        time: dayjs(values.time).format('HH:mm'),
        tagColor: CUSTOM_EVENT_COLOR
      };
      const created = await createCalendarEvent(payload);
      setEvents((prev) => [...prev, created]);
      todoForm.resetFields();
      message.success('待办事项已添加');
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '新增待办失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTodoDelete = useCallback(
    async (id: string) => {
      try {
        await deleteCalendarEvent(id);
        setEvents((prev) => prev.filter((event) => event.id !== id));
        message.success('待办事项已删除');
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '删除待办失败，请稍后重试';
        message.error(errorMessage);
      }
    },
    []
  );

  const handleHearingClick = useCallback(
    (caseId: string) => {
      if (!caseId) {
        message.warning('未关联案件，无法查看详情');
        return;
      }
      void openWorkInjuryCaseDetail(caseId);
    },
    [openWorkInjuryCaseDetail]
  );

  const dateCellRender: CalendarProps<Dayjs>['cellRender'] = (current) => {
    const dateKey = current.format('YYYY-MM-DD');
    const cellEvents = eventsByDate.get(dateKey) ?? [];
    if (cellEvents.length !== 0) {
      return (
        <ul className={styles.dateCellList}>
          {cellEvents.slice(0, 3).map((event) => (
            <li key={event.id} className={styles.dateCellItem}>
              <Badge color={event.tagColor || CUSTOM_EVENT_COLOR} />
              <span>{event.eventTime ?? '全天'}</span>
            </li>
          ))}
          {cellEvents.length > 3 ? <li className={styles.dateCellItem}>…</li> : null}
        </ul>
    );
    }
    return null;
  };

  return (
    <Drawer
      title="日程中心"
      placement="right"
      width={920}
      open={open}
      onClose={onClose}
      destroyOnHidden={false}
    >
      <div className={styles.drawerBody}>
        <div className={styles.calendarWrapper}>
          <Calendar
            fullscreen={false}
            value={calendarValue}
            onSelect={handleCalendarSelect}
            cellRender={dateCellRender}
          />
        </div>
        <div className={styles.todoWrapper}>
          <div className={styles.todoHeader}>
            <Title level={5} style={{ margin: 0 }}>
              {dayjs(selectedDate).format('YYYY年MM月DD日')} 日程
            </Title>
          </div>
          <div>
            <Form form={todoForm} layout="inline" onFinish={handleTodoSubmit} style={{ gap: 12 }}>
              <Form.Item<TodoFormValues>
                name="time"
                rules={[{ required: true, message: '请选择时间' }]}
              >
                <TimePicker format="HH:mm" minuteStep={1} placeholder="时间" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item<TodoFormValues>
                name="title"
                rules={[{ required: true, message: '请输入待办事项' }]}
              >
                <Input placeholder="待办事项内容" style={{ width: 260 }} maxLength={80} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<ClockCircleOutlined />} loading={submitting}>
                  新增
                </Button>
              </Form.Item>
            </Form>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div className={styles.todoList}>
            {loadingEvents && selectedEvents.length === 0 ? (
              <div className={styles.emptyState}>
                <Spin />
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className={styles.emptyState}>
                <Empty description="当天暂无日程" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {selectedEvents.map((event) => (
                  <div key={event.id} className={styles.todoItem}>
                    <div className={styles.todoContent}>
                      <Space align="baseline" size={8}>
                        <Text strong>{event.eventTime ?? '全天'}</Text>
                        <Tag color={event.tagColor || CUSTOM_EVENT_COLOR}>{event.type === 'hearing' ? '开庭' : '待办'}</Tag>
                      </Space>
                      <Text>{event.type === 'hearing' ? event.metadata?.caseNumber ?? event.title : event.title}</Text>
                      {event.description ? (
                        <Text type="secondary" className={styles.todoDescription}>{event.description}</Text>
                      ) : null}
                      <Space size={4}>
                        {event.type === 'hearing' && event.metadata?.trialStage ? (
                          <Tag>{formatTrialStage(event.metadata?.trialStage)}</Tag>
                        ) : null}
                      </Space>
                    </div>
                    <div className={styles.todoActions}>
                      {event.type === 'hearing' ? (
                        <Button
                          type="link"
                          onClick={() => event.relatedCaseId && handleHearingClick(event.relatedCaseId)}
                          disabled={!event.relatedCaseId}
                        >
                          查看案件
                        </Button>
                      ) : canCreateCustomEvent ? (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleTodoDelete(event.id)}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </Space>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default ScheduleDrawer;
