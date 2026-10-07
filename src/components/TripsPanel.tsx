import {
  Box, Collapse, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText,
  Table, Thead, Tbody, Tr, Th, Td, Spinner, Text, Badge,
  useColorModeValue, Flex, Select, HStack, IconButton,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';
import { INSIGHT_TRIPS_IHS, TRIPS_PHASE_COLOR } from '../constants/ids';

const INSIGHT_TRIP_PARTS = '6a7192c94af977ffe55bbc7e';

interface PartRow {
  id: string;
  phase: string;
  trip: string | null;
  partNumber: string | null;
  description: string | null;
  quantityRequired: number | null;
  quantityPicked: number | null;
  inventoryItem: string | null;
  supplierPrice: number | null;
  sku: string | null;
  invName: string | null;
}

interface TripRow {
  id: string;
  name: string;
  phase: string;
  yearOfService: string | null;
  invoicedAmount: number | null;
  arrivalDate: number | null;
  company: string | null;
  ticketCode: string | null;
  serviceType: string | null;
  assignedTraveler: string | null;
  airfare: number | null;
  hotel: number | null;
  meals: number | null;
  transportation: number | null;
  other: number | null;
}

function fmt(val: number | null): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return '€' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(val: number | null): string {
  if (!val || isNaN(val)) return '—';
  return new Date(Number(val) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const currentYear = new Date().getFullYear().toString();

interface Props { refreshKey?: number }
export default function TripsPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [partsMap, setPartsMap] = useState<Record<string, PartRow[]>>({});
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const cardBg = useColorModeValue('white', 'gray.700');
  const rowHover = useColorModeValue('gray.50', 'gray.600');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg = useColorModeValue('gray.50', 'gray.800');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_TRIPS_IHS, { update: true }),
      hailer!.insight.data(INSIGHT_TRIP_PARTS, { update: true }),
    ]).then(([tripsData, partsData]) => {
      const headers: string[] = tripsData.headers;
      const parsed: TripRow[] = tripsData.rows.map((row: unknown[]) => {
        const r: Record<string, unknown> = {};
        headers.forEach((h, i) => { r[h] = row[i]; });
        return r as unknown as TripRow;
      });
      setRows(parsed);

      // Build parts map keyed by trip ID
      const pHeaders: string[] = partsData.headers;
      const parts: PartRow[] = partsData.rows.map((row: unknown[]) => {
        const r: Record<string, unknown> = {};
        pHeaders.forEach((h, i) => { r[h] = row[i]; });
        return r as unknown as PartRow;
      });
      const map: Record<string, PartRow[]> = {};
      parts.forEach(p => {
        if (p.trip) {
          if (!map[p.trip]) map[p.trip] = [];
          map[p.trip].push(p);
        }
      });
      setPartsMap(map);
      setLoading(false);
    }).catch(err => {
      setError(String(err));
      setLoading(false);
    });
  }, [inside, refreshKey]);

  // Group by year of service
  const yearMap: Record<string, TripRow[]> = {};
  for (const r of rows) {
    const year = String(r.yearOfService || 'Unknown').trim();
    if (!yearMap[year]) yearMap[year] = [];
    yearMap[year].push(r);
  }
  const years = Object.keys(yearMap).sort((a, b) => b.localeCompare(a));
  const filteredRows = yearMap[selectedYear] || [];
  // Money totals only count trips in Follow-Up Activities: earlier phases can still have parts and
  // expenses added or removed, so calculating them there isn't meaningful yet. (Closed trips are
  // not in this panel's data — they're counted on the Revenue tab.) The list below still shows every open trip.
  const countedRows = filteredRows.filter(r => r.phase.trim() === 'Follow-Up Activities');
  const revenueForYear = countedRows.reduce((sum, r) => sum + (Number(r.invoicedAmount) || 0), 0);
  const travelExpenses = countedRows.reduce((sum, r) =>
    sum + (Number(r.airfare) || 0) + (Number(r.hotel) || 0) + (Number(r.meals) || 0) +
    (Number(r.transportation) || 0) + (Number(r.other) || 0), 0);
  const partsCostForYear = countedRows.reduce((sum, r) => {
    const parts = partsMap[r.id] || [];
    return sum + parts.reduce((ps, p) => ps + ((Number(p.supplierPrice) || 0) * (Number(p.quantityRequired) || 1)), 0);
  }, 0);
  const totalExpenses = travelExpenses + partsCostForYear;

  if (loading) return <Flex justify="center" align="center" h="200px"><Spinner size="xl" /></Flex>;
  if (error) return <Text color="red.500">Error loading data: {error}</Text>;

  return (
    <Box>
      <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Open TRIPS / IHS</StatLabel>
            <StatNumber>{rows.length}</StatNumber>
            <StatHelpText>All open phases</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Revenue — {selectedYear}</StatLabel>
            <StatNumber fontSize="xl">{fmt(revenueForYear)}</StatNumber>
            <StatHelpText>{countedRows.length} Follow-Up trip{countedRows.length === 1 ? '' : 's'} counted</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Total Expenses</StatLabel>
            <StatNumber fontSize="xl" color="red.500">{fmt(totalExpenses)}</StatNumber>
            <StatHelpText>Travel: {fmt(travelExpenses)} + Parts: {fmt(partsCostForYear)} · Follow-Up only</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Years of Service</StatLabel>
            <StatNumber fontSize="sm" mt={1}>
              {years.slice(0, 5).map(y => (
                <Flex key={y} justify="space-between" mb={1}>
                  <Text as="span" mr={2}>{y}</Text>
                  <Text as="span" fontWeight="bold">{yearMap[y].length}</Text>
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

      {filteredRows.length === 0 ? (
        <Text color="gray.500">No open TRIPS/IHS found for {selectedYear}.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th></Th>
                <Th>Code</Th>
                <Th>Name / Company</Th>
                <Th>Phase</Th>
                <Th>Service Type</Th>
                <Th>Assigned Engineer</Th>
                <Th>Arrival Date</Th>
                <Th isNumeric>Invoiced Amount</Th>
                <Th isNumeric>Parts Cost</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredRows.map(r => {
                const parts = partsMap[r.id] || [];
                const partsCost = parts.reduce((s, p) => s + ((Number(p.supplierPrice) || 0) * (Number(p.quantityRequired) || 1)), 0);
                const isExpanded = expandedTrip === r.id;
                return (
                  <>
                    <Tr key={r.id} _hover={{ bg: rowHover }} cursor="pointer">
                      <Td px={2}>
                        {parts.length > 0 && (
                          <Text fontSize="xs" color="blue.500" fontWeight="bold"
                            onClick={() => setExpandedTrip(isExpanded ? null : r.id)}>
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                        )}
                      </Td>
                      <Td fontWeight="medium" whiteSpace="nowrap" onClick={() => hailer!.ui.activity.open(r.id)}>{r.ticketCode || '—'}</Td>
                      <Td maxW="220px" onClick={() => hailer!.ui.activity.open(r.id)}>
                        <Text fontWeight="medium" isTruncated>{r.name}</Text>
                        <Text fontSize="xs" color="gray.500">{r.company || ''}</Text>
                      </Td>
                      <Td onClick={() => hailer!.ui.activity.open(r.id)}>
                        <Badge colorScheme={TRIPS_PHASE_COLOR[r.phase] || 'gray'}>{r.phase || '—'}</Badge>
                      </Td>
                      <Td whiteSpace="nowrap" onClick={() => hailer!.ui.activity.open(r.id)}>{r.serviceType || '—'}</Td>
                      <Td whiteSpace="nowrap" onClick={() => hailer!.ui.activity.open(r.id)}>
                        {r.assignedTraveler
                          ? (() => { const u = user.map[r.assignedTraveler]; return u ? `${u.firstname} ${u.lastname}` : r.assignedTraveler; })()
                          : '—'}
                      </Td>
                      <Td whiteSpace="nowrap" onClick={() => hailer!.ui.activity.open(r.id)}>{fmtDate(r.arrivalDate)}</Td>
                      <Td isNumeric onClick={() => hailer!.ui.activity.open(r.id)}>{fmt(r.invoicedAmount)}</Td>
                      <Td isNumeric color={partsCost > 0 ? 'red.500' : 'gray.400'} fontWeight={partsCost > 0 ? 'bold' : 'normal'}>
                        {partsCost > 0 ? fmt(partsCost) : parts.length > 0 ? `${parts.length} parts` : '—'}
                      </Td>
                    </Tr>
                    {isExpanded && parts.length > 0 && (
                      <Tr key={`${r.id}-parts`} bg={useColorModeValue('blue.50', 'blue.900')}>
                        <Td colSpan={9} px={4} py={2}>
                          <Table size="xs" variant="simple">
                            <Thead>
                              <Tr>
                                <Th fontSize="xs">Part #</Th>
                                <Th fontSize="xs">Description</Th>
                                <Th isNumeric fontSize="xs">Qty</Th>
                                <Th isNumeric fontSize="xs">Unit Cost</Th>
                                <Th isNumeric fontSize="xs">Total</Th>
                                <Th fontSize="xs">Status</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {parts.map(p => (
                                <Tr key={p.id}>
                                  <Td fontSize="xs" fontWeight="medium">{p.partNumber || '—'}</Td>
                                  <Td fontSize="xs">{p.invName || p.description || '—'}</Td>
                                  <Td isNumeric fontSize="xs">{p.quantityRequired || 1}</Td>
                                  <Td isNumeric fontSize="xs">{p.supplierPrice ? fmt(p.supplierPrice) : '—'}</Td>
                                  <Td isNumeric fontSize="xs" fontWeight="bold">
                                    {p.supplierPrice ? fmt((Number(p.supplierPrice) || 0) * (Number(p.quantityRequired) || 1)) : '—'}
                                  </Td>
                                  <Td fontSize="xs"><Badge fontSize="xs" colorScheme={p.phase === 'Picked' ? 'green' : p.phase === 'Backordered' ? 'red' : 'yellow'}>{p.phase}</Badge></Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </Td>
                      </Tr>
                    )}
                  </>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
