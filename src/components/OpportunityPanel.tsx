import {
  Box, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText,
  Table, Thead, Tbody, Tr, Th, Td, Spinner, Text, Badge, useColorModeValue, Flex, Divider, Heading,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';
import { INSIGHT_OPPORTUNITIES, OPP_PHASE_COLOR } from '../constants/ids';

interface OppRow {
  id: string;
  name: string;
  phase: string;
  quotedRevenue: number | null;
  tmxeRevenue: number | null;
  closeDate: number | null;
  expectedDecision: number | null;
  poReceivedDate: number | null;
  closedWonDate: number | null;
}

function fmt(val: number | null): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '—';
  return '€' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Insight returns timestamps in seconds — multiply by 1000 for JS Date
function fmtDate(val: number | null): string {
  if (!val || isNaN(Number(val))) return '—';
  return new Date(Number(val) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function wonYear(val: number | null): string {
  if (!val || isNaN(Number(val))) return 'Unknown';
  return new Date(Number(val) * 1000).getFullYear().toString();
}

interface Props { refreshKey?: number }
export default function OpportunityPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const [rows, setRows] = useState<OppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.700');
  const wonBg = useColorModeValue('green.50', 'green.900');
  const wonBorder = useColorModeValue('green.200', 'green.700');
  const rowHover = useColorModeValue('gray.50', 'gray.600');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg = useColorModeValue('gray.50', 'gray.800');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    hailer!.insight.data(INSIGHT_OPPORTUNITIES, { update: true })
      .then(data => {
        const headers: string[] = data.headers;
        const parsed: OppRow[] = data.rows.map((row: unknown[]) => {
          const r: Record<string, unknown> = {};
          headers.forEach((h, i) => { r[h] = row[i]; });
          return r as unknown as OppRow;
        });
        setRows(parsed);
        setLoading(false);
      })
      .catch(err => {
        setError(String(err));
        setLoading(false);
      });
  }, [inside, refreshKey]);

  const openRows = rows.filter(r => r.phase !== 'Closed - Won');
  const wonRows = rows.filter(r => r.phase === 'Closed - Won');

  const totalQuoted = openRows.reduce((sum, r) => sum + (Number(r.quotedRevenue) || 0), 0);
  const totalTmxe = openRows.reduce((sum, r) => sum + (Number(r.tmxeRevenue) || 0), 0);
  const totalWonQuoted = wonRows.reduce((sum, r) => sum + (Number(r.quotedRevenue) || 0), 0);
  const totalWonTmxe = wonRows.reduce((sum, r) => sum + (Number(r.tmxeRevenue) || 0), 0);

  const openPhases = ['Discovery', 'Proposal', 'Negotiations'];
  const phaseCounts = openPhases.reduce<Record<string, number>>((acc, p) => {
    acc[p] = rows.filter(r => r.phase === p).length;
    return acc;
  }, {});

  // Group won by year
  const wonByYear: Record<string, { count: number; quoted: number; tmxe: number; rows: OppRow[] }> = {};
  for (const r of wonRows) {
    const yr = wonYear(r.closedWonDate);
    if (!wonByYear[yr]) wonByYear[yr] = { count: 0, quoted: 0, tmxe: 0, rows: [] };
    wonByYear[yr].count++;
    wonByYear[yr].quoted += Number(r.quotedRevenue) || 0;
    wonByYear[yr].tmxe += Number(r.tmxeRevenue) || 0;
    wonByYear[yr].rows.push(r);
  }
  const wonYears = Object.keys(wonByYear).sort((a, b) => b.localeCompare(a));

  if (loading) return <Flex justify="center" align="center" h="200px"><Spinner size="xl" /></Flex>;
  if (error) return <Text color="red.500">Error loading data: {error}</Text>;

  return (
    <Box>
      {/* Open pipeline summary */}
      <Heading size="sm" mb={3} color="gray.500" textTransform="uppercase" letterSpacing="wide">Open Pipeline</Heading>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Open Opportunities</StatLabel>
            <StatNumber>{openRows.length}</StatNumber>
            <StatHelpText>Active pipeline</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Quoted Total Revenue</StatLabel>
            <StatNumber fontSize="xl">{fmt(totalQuoted)}</StatNumber>
            <StatHelpText>All open stages</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>TMXE Total Revenue</StatLabel>
            <StatNumber fontSize="xl">{fmt(totalTmxe)}</StatNumber>
            <StatHelpText>System sale</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>By Stage</StatLabel>
            <StatNumber fontSize="sm" mt={1}>
              {openPhases.map(p => (
                <Flex key={p} justify="space-between" mb={1}>
                  <Badge colorScheme={OPP_PHASE_COLOR[p] || 'gray'} mr={2}>{p}</Badge>
                  <Text as="span" fontWeight="bold">{phaseCounts[p]}</Text>
                </Flex>
              ))}
            </StatNumber>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Open pipeline table */}
      {openRows.length === 0 ? (
        <Text color="gray.500" mb={6}>No open opportunities found.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md" mb={8}>
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Name</Th>
                <Th>Stage</Th>
                <Th isNumeric>Quoted Revenue</Th>
                <Th isNumeric>TMXE Revenue</Th>
                <Th>Expected Decision</Th>
              </Tr>
            </Thead>
            <Tbody>
              {openRows.map(r => (
                <Tr key={r.id} _hover={{ bg: rowHover }} cursor="pointer"
                  onClick={() => hailer!.ui.activity.open(r.id)}>
                  <Td fontWeight="medium" maxW="250px" isTruncated>{r.name}</Td>
                  <Td><Badge colorScheme={OPP_PHASE_COLOR[r.phase] || 'gray'}>{r.phase || '—'}</Badge></Td>
                  <Td isNumeric>{fmt(r.quotedRevenue)}</Td>
                  <Td isNumeric>{fmt(r.tmxeRevenue)}</Td>
                  <Td>{fmtDate(r.expectedDecision)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <Divider mb={6} />

      {/* Closed Won section */}
      <Heading size="sm" mb={3} color="green.600" textTransform="uppercase" letterSpacing="wide">Closed — Won</Heading>

      {/* Won totals */}
      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={6}>
        <Box p={4} bg={wonBg} borderRadius="md" shadow="sm" border="1px" borderColor={wonBorder}>
          <Stat>
            <StatLabel>Total Won</StatLabel>
            <StatNumber>{wonRows.length}</StatNumber>
            <StatHelpText>All time</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={wonBg} borderRadius="md" shadow="sm" border="1px" borderColor={wonBorder}>
          <Stat>
            <StatLabel>Won Quoted Revenue</StatLabel>
            <StatNumber fontSize="xl">{fmt(totalWonQuoted)}</StatNumber>
            <StatHelpText>All time</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={wonBg} borderRadius="md" shadow="sm" border="1px" borderColor={wonBorder}>
          <Stat>
            <StatLabel>Won TMXE Revenue</StatLabel>
            <StatNumber fontSize="xl">{fmt(totalWonTmxe)}</StatNumber>
            <StatHelpText>All time</StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Won by year */}
      {wonYears.length > 0 && (
        <>
          <Heading size="xs" mb={3} color="gray.500">By Year Won</Heading>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={6}>
            {wonYears.map(yr => (
              <Box key={yr} p={3} bg={wonBg} borderRadius="md" border="1px" borderColor={wonBorder}
                borderTop="3px solid" borderTopColor="green.400">
                <Stat>
                  <StatLabel fontWeight="bold">{yr}</StatLabel>
                  <StatNumber fontSize="lg">{wonByYear[yr].count}</StatNumber>
                  <StatHelpText fontSize="xs">{fmt(wonByYear[yr].quoted)}</StatHelpText>
                  <StatHelpText fontSize="xs">TMXE: {fmt(wonByYear[yr].tmxe)}</StatHelpText>
                </Stat>
              </Box>
            ))}
          </SimpleGrid>

          {/* Won table */}
          <Box overflowX="auto" border="1px" borderColor={wonBorder} borderRadius="md">
            <Table variant="simple" size="sm">
              <Thead bg={useColorModeValue('green.50', 'green.900')}>
                <Tr>
                  <Th>Name</Th>
                  <Th>Year Won</Th>
                  <Th isNumeric>Quoted Revenue</Th>
                  <Th isNumeric>TMXE Revenue</Th>
                  <Th>Won Date</Th>
                </Tr>
              </Thead>
              <Tbody>
                {wonRows.sort((a, b) => (b.closedWonDate || 0) - (a.closedWonDate || 0)).map(r => (
                  <Tr key={r.id} _hover={{ bg: rowHover }} cursor="pointer"
                    onClick={() => hailer!.ui.activity.open(r.id)}>
                    <Td fontWeight="medium" maxW="250px" isTruncated>{r.name}</Td>
                    <Td><Badge colorScheme="green">{wonYear(r.closedWonDate)}</Badge></Td>
                    <Td isNumeric>{fmt(r.quotedRevenue)}</Td>
                    <Td isNumeric>{fmt(r.tmxeRevenue)}</Td>
                    <Td>{fmtDate(r.closedWonDate)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </>
      )}
    </Box>
  );
}
