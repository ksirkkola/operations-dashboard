import {
  Box, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText,
  Table, Thead, Tbody, Tr, Th, Td, Spinner, Text, Badge,
  useColorModeValue, Flex, Select,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';
import { INSIGHT_SUPPORT_TICKETS, ST_PHASE_COLOR } from '../constants/ids';

const INSIGHT_RESOLVED = '6a4618a1e63a006e15353ada';

interface TicketRow {
  id: string;
  name: string;
  phase: string;
  ticketCode: string | null;
  company: string | null;
  issues: string | null;
  dateReceived: number | null;
  assignedEngineer: string | null;
  billable: string | null;
}

function fmtDate(val: number | null): string {
  if (!val || isNaN(val)) return '—';
  return new Date(Number(val) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const OPEN_PHASES = ['New Ticket', 'Triage', 'Working with Client', 'Software Upgrade', 'Follow-Up Activities', 'Waiting on Billing'];

interface Props { refreshKey?: number }
export default function SupportTicketsPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [avgDays, setAvgDays] = useState<number | null>(null);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [selectedEngineer, setSelectedEngineer] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.700');
  const rowHover = useColorModeValue('gray.50', 'gray.600');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg = useColorModeValue('gray.50', 'gray.800');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_SUPPORT_TICKETS, { update: true }),
      hailer!.insight.data(INSIGHT_RESOLVED, { update: true }),
    ]).then(([openData, resolvedData]) => {
      const headers: string[] = openData.headers;
      const parsed: TicketRow[] = openData.rows.map((row: unknown[]) => {
        const r: Record<string, unknown> = {};
        headers.forEach((h, i) => { r[h] = row[i]; });
        return r as unknown as TicketRow;
      });
      setRows(parsed);

      // Calculate average resolution time in days
      const resolved = resolvedData.rows.filter(r => r[1] && r[2]);
      setResolvedCount(resolved.length);
      if (resolved.length > 0) {
        const totalDays = resolved.reduce((sum, r) => {
          const start = Number(r[1]) * 1000;
          const end = Number(r[2]) * 1000;
          return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        }, 0);
        setAvgDays(Math.round(totalDays / resolved.length));
      }

      setLoading(false);
    }).catch(err => {
      setError(String(err));
      setLoading(false);
    });
  }, [inside, refreshKey]);

  // Build list of unique engineers from rows
  const engineers = Array.from(new Set(rows.map(r => r.assignedEngineer).filter(Boolean))) as string[];

  const filteredRows = selectedEngineer === 'all'
    ? rows
    : rows.filter(r => r.assignedEngineer === selectedEngineer);

  const phaseCounts = OPEN_PHASES.reduce<Record<string, number>>((acc, p) => {
    acc[p] = filteredRows.filter(r => r.phase === p).length;
    return acc;
  }, {});

  if (loading) return <Flex justify="center" align="center" h="200px"><Spinner size="xl" /></Flex>;
  if (error) return <Text color="red.500">Error loading data: {error}</Text>;

  return (
    <Box>
      <Flex align="center" gap={3} mb={4}>
        <Text fontWeight="semibold" whiteSpace="nowrap">Engineer:</Text>
        <Select maxW="220px" size="sm" value={selectedEngineer} onChange={e => setSelectedEngineer(e.target.value)}>
          <option value="all">All Engineers</option>
          {engineers.map(id => {
            const u = user.map[id];
            return <option key={id} value={id}>{u ? `${u.firstname} ${u.lastname}` : id}</option>;
          })}
        </Select>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={3} mb={4}>
        {OPEN_PHASES.map(p => (
          <Box key={p} p={3} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
            borderTop="3px solid" borderTopColor={`${ST_PHASE_COLOR[p] || 'gray'}.400`}>
            <Stat>
              <StatLabel fontSize="xs" noOfLines={2}>{p}</StatLabel>
              <StatNumber>{phaseCounts[p]}</StatNumber>
            </Stat>
          </Box>
        ))}
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={5}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Total Open Tickets</StatLabel>
            <StatNumber>{filteredRows.length}</StatNumber>
            <StatHelpText>Across all active phases</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Avg Resolution Time</StatLabel>
            <StatNumber>{avgDays !== null ? `${avgDays} days` : '—'}</StatNumber>
            <StatHelpText>Based on {resolvedCount} resolved ticket{resolvedCount !== 1 ? 's' : ''}</StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      {filteredRows.length === 0 ? (
        <Text color="gray.500">No open support tickets found.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Code</Th>
                <Th>Company</Th>
                <Th>Issue</Th>
                <Th>Phase</Th>
                <Th>Assigned To</Th>
                <Th>Date Received</Th>
                <Th>Billable</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredRows.map(r => (
                <Tr key={r.id} _hover={{ bg: rowHover }} cursor="pointer"
                  onClick={() => hailer!.ui.activity.open(r.id)}>
                  <Td fontWeight="bold" whiteSpace="nowrap">{r.ticketCode || r.name}</Td>
                  <Td maxW="160px" isTruncated>{r.company || '—'}</Td>
                  <Td maxW="260px">
                    <Text isTruncated fontSize="sm" title={r.issues || ''}>{r.issues || '—'}</Text>
                  </Td>
                    <Td whiteSpace="nowrap">
                      <Badge colorScheme={ST_PHASE_COLOR[r.phase] || 'gray'}>{r.phase || '—'}</Badge>
                    </Td>
                    <Td whiteSpace="nowrap">
                      {r.assignedEngineer
                        ? (() => { const u = user.map[r.assignedEngineer]; return u ? `${u.firstname} ${u.lastname}` : r.assignedEngineer; })()
                        : '—'}
                    </Td>
                  <Td whiteSpace="nowrap">{fmtDate(r.dateReceived)}</Td>
                    <Td whiteSpace="nowrap">
                      {r.billable ? (
                        <Badge colorScheme={r.billable === 'Yes' ? 'green' : 'gray'}>{r.billable}</Badge>
                      ) : '—'}
                    </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
