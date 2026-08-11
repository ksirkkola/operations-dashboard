import {
  Box, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText,
  Table, Thead, Tbody, Tr, Th, Td, Spinner, Text, Badge,
  useColorModeValue, Flex, Select,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_CONFERENCES = '6a46119536433d11d17cebf3';

const currentYear = new Date().getFullYear().toString();

interface ConfRow {
  id: string;
  name: string;
  phase: string;
  conferenceCode: string | null;
  location: string | null;
  planningStart: number | null;
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
};

interface Props { refreshKey?: number }
export default function ConferencesPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const [rows, setRows] = useState<ConfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);

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

  // Group by Year of Conference field (falls back to planningStart year)
  const yearMap: Record<string, ConfRow[]> = {};
  for (const r of rows) {
    const year = r.yearOfConference ? String(r.yearOfConference).trim() : getYear(r.planningStart);
    if (!yearMap[year]) yearMap[year] = [];
    yearMap[year].push(r);
  }
  const years = Object.keys(yearMap).sort((a, b) => b.localeCompare(a));
  const filteredRows = yearMap[selectedYear] || rows; // show all if no year matches

  const totalExpensesForYear = filteredRows.reduce((sum, r) => sum + totalCost(r), 0);

  const phaseCounts: Record<string, number> = {};
  for (const r of filteredRows) {
    phaseCounts[r.phase] = (phaseCounts[r.phase] || 0) + 1;
  }

  if (loading) return <Flex justify="center" align="center" h="200px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error loading data: {error}</Text>;

  if (rows.length === 0) return (
    <Text color="gray.500" mt={4}>No conferences found. Add conferences to the Conference Tracking workflow to see them here.</Text>
  );

  return (
    <Box>
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
            <StatHelpText>{selectedYear}</StatHelpText>
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
                <Td whiteSpace="nowrap">{fmtDate(r.planningStart)}</Td>
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
