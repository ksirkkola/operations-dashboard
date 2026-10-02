import {
  Box, Button, Heading, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText,
  Table, Thead, Tbody, Tr, Th, Td, Spinner, Text, Badge,
  useColorModeValue, Flex, Select, HStack, useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';
import { syncConferencesToCalendar } from '../conferenceCalendarSync';

const INSIGHT_CONFERENCES = '6a46119536433d11d17cebf3';

const currentYear = new Date().getFullYear().toString();

interface ConfRow {
  id: string;
  name: string;
  phase: string;
  conferenceCode: string | null;
  location: string | null;
  planningStart: number | null;
  conferenceDatesStart: number | null;
  conferenceDatesEnd: number | null;
  yearOfConference: string | null;
  registrationCost: number | null;
  hotelCost: number | null;
  travelCost: number | null;
  logistics: number | null;
  transportationCost: number | null;
  otherCost: number | null;
  worthIt: string | null;
}

function fmt(val: unknown): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(val: unknown): string {
  if (!val || isNaN(Number(val))) return '—';
  return new Date(Number(val) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getYear(val: unknown): string {
  if (!val || isNaN(Number(val))) return 'Unknown';
  return new Date(Number(val) * 1000).getFullYear().toString();
}

function totalCost(r: ConfRow): number {
  return (Number(r.registrationCost) || 0) + (Number(r.hotelCost) || 0) +
    (Number(r.travelCost) || 0) + (Number(r.logistics) || 0) +
    (Number(r.transportationCost) || 0) + (Number(r.otherCost) || 0);
}

const PHASE_COLOR: Record<string, string> = {
  'New Conference': 'blue',
  'Planning': 'cyan',
  'Pre-Event Outreach': 'purple',
  'Onsite Execution': 'green',
  'Follow-Up': 'orange',
  'ROI Review': 'yellow',
  'Done': 'gray',
  'Cancelled': 'red',
};

const WORKFLOW_CONFERENCE_TRACKING = '6a192ecf0965f762b3ea50b9';
const PHASE_NEW_CONFERENCE = '6a192ed10965f762b3ea50e9';

interface Props { refreshKey?: number; onRefresh?: () => void }
export default function ConferencesPanel({ refreshKey = 0, onRefresh }: Props) {
  const { hailer, inside } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState<ConfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSyncCalendar() {
    setSyncing(true);
    try {
      const result = await syncConferencesToCalendar(hailer!);
      toast({
        title: 'Synced to Conference Schedule calendar',
        description: `${result.created} event${result.created === 1 ? '' : 's'} created` +
          (result.skipped.length ? ` — ${result.skipped.length} conference${result.skipped.length === 1 ? '' : 's'} skipped (missing dates)` : ''),
        status: 'success', duration: 5000, isClosable: true,
      });
    } catch (err) {
      toast({ title: 'Calendar sync failed', description: String(err), status: 'error', duration: 6000, isClosable: true });
    }
    setSyncing(false);
  }

  const cardBg     = useColorModeValue('white', 'gray.700');
  const rowHover   = useColorModeValue('gray.50', 'gray.600');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg    = useColorModeValue('gray.50', 'gray.800');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    hailer!.insight.data(INSIGHT_CONFERENCES, { update: true })
      .then(data => {
        const headers: string[] = data.headers;
        const parsed: ConfRow[] = data.rows.map((row: unknown[]) => {
          const r: Record<string, unknown> = {};
          headers.forEach((h, i) => { r[h] = row[i]; });
          return r as unknown as ConfRow;
        });
        setRows(parsed);
        setLoading(false);
      })
      .catch(err => {
        setError(String(err));
        setLoading(false);
      });
  }, [inside, refreshKey]);

  // Group by Year of Conference field if manually set, else the actual
  // Conference Dates (NOT Planning Start — that's when prep began, which can
  // legitimately be a year+ before the conference itself for far-out events).
  const yearMap: Record<string, ConfRow[]> = {};
  for (const r of rows) {
    const year = r.yearOfConference ? String(r.yearOfConference).trim() : getYear(r.conferenceDatesStart ?? r.planningStart);
    if (!yearMap[year]) yearMap[year] = [];
    yearMap[year].push(r);
  }
  const years = Object.keys(yearMap).sort((a, b) => b.localeCompare(a));
  const filteredRows = yearMap[selectedYear] || rows; // show all if no year matches

  // Cancelled conferences never happened — keep them visible in the list/phase
  // counts (so it's clear one was planned and fell through) but exclude their
  // costs from the year's Total Expenses so cancelled spend doesn't skew
  // year-over-year comparisons.
  const totalExpensesForYear = filteredRows
    .filter(r => r.phase !== 'Cancelled')
    .reduce((sum, r) => sum + totalCost(r), 0);

  const phaseCounts: Record<string, number> = {};
  for (const r of filteredRows) {
    phaseCounts[r.phase] = (phaseCounts[r.phase] || 0) + 1;
  }

  async function handleNewConference() {
    setCreating(true);
    try {
      const created = await hailer!.ui.activity.create(WORKFLOW_CONFERENCE_TRACKING, { phaseId: PHASE_NEW_CONFERENCE });
      if (created) {
        hailer!.ui.snackbar.open('Conference created.', 'OK', 3000).catch(() => {});
        onRefresh?.();
      }
    } catch (err) {
      console.error('Create conference failed:', err);
    }
    setCreating(false);
  }

  const header = (
    <Flex justify="space-between" align="center" mb={6}>
      <Heading size="sm" color="gray.500" textTransform="uppercase" letterSpacing="wide">Conferences</Heading>
      <HStack>
        <Button size="sm" colorScheme="purple" variant="outline" isLoading={syncing} onClick={handleSyncCalendar}>
          🗓️ Sync Conferences to Calendar
        </Button>
        <Button size="sm" colorScheme="blue" isLoading={creating} onClick={handleNewConference}>
          + Add New Conference
        </Button>
      </HStack>
    </Flex>
  );

  if (loading) return <Flex justify="center" align="center" h="200px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error loading data: {error}</Text>;

  if (rows.length === 0) return (
    <Box>
      {header}
      <Text color="gray.500" mt={4}>No conferences found. Click "+ Add New Conference" above to add your first one.</Text>
    </Box>
  );

  return (
    <Box>
      {header}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Total Conferences</StatLabel>
            <StatNumber>{filteredRows.length}</StatNumber>
            <StatHelpText>{selectedYear}</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Total Expenses</StatLabel>
            <StatNumber fontSize="xl" color="red.500">{fmt(totalExpensesForYear)}</StatNumber>
            <StatHelpText>{selectedYear} — excludes cancelled</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>By Phase</StatLabel>
            <StatNumber fontSize="sm" mt={1}>
              {Object.entries(phaseCounts).map(([phase, count]) => (
                <Flex key={phase} justify="space-between" mb={1}>
                  <Badge colorScheme={PHASE_COLOR[phase] || 'gray'} mr={2} fontSize="xs">{phase}</Badge>
                  <Text as="span" fontWeight="bold">{count}</Text>
                </Flex>
              ))}
            </StatNumber>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Filter by Year</StatLabel>
            <Select mt={2} size="sm" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y} ({yearMap[y].length})</option>)}
            </Select>
          </Stat>
        </Box>
      </SimpleGrid>

      <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
        <Table variant="simple" size="sm">
          <Thead bg={theadBg}>
            <Tr>
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Location</Th>
              <Th>Phase</Th>
              <Th>Start Date</Th>
              <Th isNumeric>Registration</Th>
              <Th isNumeric>Hotel</Th>
              <Th isNumeric>Travel</Th>
              <Th isNumeric>Logistics</Th>
              <Th isNumeric>Transport</Th>
              <Th isNumeric>Other</Th>
              <Th isNumeric>Total</Th>
              <Th>Worth It?</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredRows.map(r => (
              <Tr key={r.id} _hover={{ bg: rowHover }} cursor="pointer"
                onClick={() => hailer!.ui.activity.open(r.id)}>
                <Td whiteSpace="nowrap" fontWeight="bold">{r.conferenceCode || '—'}</Td>
                <Td maxW="180px" isTruncated fontWeight="medium">{r.name}</Td>
                <Td maxW="140px" isTruncated>{r.location || '—'}</Td>
                <Td whiteSpace="nowrap">
                  <Badge colorScheme={PHASE_COLOR[r.phase] || 'gray'}>{r.phase || '—'}</Badge>
                </Td>
                <Td whiteSpace="nowrap">{fmtDate(r.conferenceDatesStart ?? r.planningStart)}</Td>
                <Td isNumeric>{fmt(r.registrationCost)}</Td>
                <Td isNumeric>{fmt(r.hotelCost)}</Td>
                <Td isNumeric>{fmt(r.travelCost)}</Td>
                <Td isNumeric>{fmt(r.logistics)}</Td>
                <Td isNumeric>{fmt(r.transportationCost)}</Td>
                <Td isNumeric>{fmt(r.otherCost)}</Td>
                <Td isNumeric fontWeight="bold">{fmt(totalCost(r))}</Td>
                <Td whiteSpace="nowrap">
                  {r.worthIt
                    ? <Badge colorScheme={r.worthIt === 'Yes' ? 'green' : r.worthIt === 'No' ? 'red' : 'gray'}>{r.worthIt}</Badge>
                    : '—'}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
