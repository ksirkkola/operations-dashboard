import {
  Box, Divider, Flex, Heading, Select, SimpleGrid, Spinner, Stat, StatHelpText,
  StatLabel, StatNumber, Table, Tbody, Td, Text, Th, Thead, Tr,
  useColorModeValue, Badge,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_OPP        = '6a435bec2742e7f71fdc5f83';
const INSIGHT_TRIPS      = '6a435befd83297a6bc168f26';
const INSIGHT_ST         = '6a435bf3885354b60a29e8f3';
const INSIGHT_CONF       = '6a450a9facc7c3a9a80cf7c9';
const INSIGHT_TRIP_PARTS = '6a71c2ab4af977ffe55cf4bd';

const ALL_YEARS = 'All Years';
const currentYear = new Date().getFullYear().toString();

function fmt(val: unknown): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function sum(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

// Timestamps from insight are in seconds
function tsToYear(val: unknown): string {
  if (!val) return 'Unknown';
  const n = Number(val);
  if (isNaN(n) || n === 0) return 'Unknown';
  return new Date(n * 1000).getFullYear().toString();
}

interface SectionProps {
  title: string;
  color: string;
  children: React.ReactNode;
}

function Section({ title, color, children }: SectionProps) {
  const bg = useColorModeValue('white', 'gray.700');
  const border = useColorModeValue('gray.200', 'gray.600');
  return (
    <Box mb={8}>
      <Heading size="sm" mb={3} color={color} textTransform="uppercase" letterSpacing="wide">{title}</Heading>
      <Box bg={bg} border="1px" borderColor={border} borderRadius="md" shadow="sm" p={4}>
        {children}
      </Box>
    </Box>
  );
}

interface Props { refreshKey?: number }
export default function RevenuePanel({ refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const [oppRows, setOppRows]     = useState<Record<string, unknown>[]>([]);
  const [tripsRows, setTripsRows] = useState<Record<string, unknown>[]>([]);
  const [stRows, setStRows]       = useState<Record<string, unknown>[]>([]);
  const [confRows, setConfRows]       = useState<Record<string, unknown>[]>([]);
  const [tripPartsRows, setTripPartsRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');
  const subtleBg    = useColorModeValue('gray.50', 'gray.800');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_OPP, { update: true }),
      hailer!.insight.data(INSIGHT_TRIPS, { update: true }),
      hailer!.insight.data(INSIGHT_ST, { update: true }),
      hailer!.insight.data(INSIGHT_CONF, { update: true }),
      hailer!.insight.data(INSIGHT_TRIP_PARTS, { update: true }),
    ]).then(([opp, trips, st, conf, tripParts]) => {
      setOppRows(parseInsight(opp));
      setTripsRows(parseInsight(trips));
      setStRows(parseInsight(st));
      setConfRows(parseInsight(conf));
      setTripPartsRows(parseInsight(tripParts));
      setLoading(false);
    }).catch(err => {
      setError(String(err));
      setLoading(false);
    });
  }, [inside, refreshKey]);

  // Year of Conference is a manually-set override; when it's not set, fall
  // back to the actual Conference Dates — NOT Planning Start (that's when
  // prep began, which can be a year+ before a far-out conference and would
  // put e.g. a 2027 conference under 2026).
  function confYear(r: Record<string, unknown>): string {
    const manual = String(r.yearOfConference || '').trim();
    if (manual) return manual;
    return tsToYear(r.conferenceDatesStart);
  }

  // Derive available years from all datasets
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    oppRows.forEach(r => { const y = tsToYear(r.closedWonDate); if (y !== 'Unknown') years.add(y); });
    tripsRows.forEach(r => { const y = String(r.yearOfService || '').trim(); if (y) years.add(y); });
    stRows.forEach(r => { const y = tsToYear(r.dateReceived); if (y !== 'Unknown') years.add(y); });
    confRows.forEach(r => { const y = confYear(r); if (y !== 'Unknown') years.add(y); });
    return [ALL_YEARS, ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  }, [oppRows, tripsRows, stRows, confRows]);

  // Filter conferences by selected year
  const filteredConf = selectedYear === ALL_YEARS
    ? confRows
    : confRows.filter(r => confYear(r) === selectedYear);

  // Cancelled conferences never happened — exclude their costs from the
  // rollup so a cancelled conference doesn't skew year-over-year expense
  // comparisons. They still appear in the table below with their own phase
  // badge and per-row total, just not counted in the headline figures.
  const filteredConfForCosts = filteredConf.filter(r => r.phase !== 'Cancelled');
  const confRegistration   = sum(filteredConfForCosts, 'registrationCost');
  const confHotel          = sum(filteredConfForCosts, 'hotelCost');
  const confTravel         = sum(filteredConfForCosts, 'travelCost');
  const confLogistics      = sum(filteredConfForCosts, 'logistics');
  const confTransportation = sum(filteredConfForCosts, 'transportationCost');
  const confOther          = sum(filteredConfForCosts, 'otherCost');
  const confTotalExpenses  = confRegistration + confHotel + confTravel + confLogistics + confTransportation + confOther;

  // Filter rows by selected year
  const filteredOpp = useMemo(() => selectedYear === ALL_YEARS
    ? oppRows
    : oppRows.filter(r => {
        if (r.phase === 'Closed - Won') return tsToYear(r.closedWonDate) === selectedYear;
        return true; // always show open pipeline regardless of year
      }), [oppRows, selectedYear]);

  const filteredTrips = useMemo(() => selectedYear === ALL_YEARS
    ? tripsRows
    : tripsRows.filter(r => String(r.yearOfService || '').trim() === selectedYear),
    [tripsRows, selectedYear]);

  const filteredSt = useMemo(() => selectedYear === ALL_YEARS
    ? stRows
    : stRows.filter(r => tsToYear(r.dateReceived) === selectedYear),
    [stRows, selectedYear]);

  if (loading) return <Flex justify="center" align="center" h="200px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error loading data: {error}</Text>;

  // Opportunity numbers
  const openOpp         = filteredOpp.filter(r => r.phase !== 'Closed - Won');
  const wonOpp          = filteredOpp.filter(r => r.phase === 'Closed - Won');
  const oppOpenQuoted   = sum(openOpp, 'quotedRevenue');
  const oppOpenTmxe     = sum(openOpp, 'tmxeRevenue');
  const oppWonQuoted    = sum(wonOpp,  'quotedRevenue');
  const oppWonTmxe      = sum(wonOpp,  'tmxeRevenue');

  // TRIPS numbers
  const tripsInvoiced      = sum(filteredTrips, 'invoicedAmount');
  const tripsPo            = sum(filteredTrips, 'poAmount');
  const tripsAirfare       = sum(filteredTrips, 'airfare');
  const tripsHotel         = sum(filteredTrips, 'hotel');
  const tripsMeals         = sum(filteredTrips, 'meals');
  const tripsTransport     = sum(filteredTrips, 'transportation');
  const tripsOther         = sum(filteredTrips, 'other');
  const tripsTravelExpenses = tripsAirfare + tripsHotel + tripsMeals + tripsTransport + tripsOther;

  // Trip parts costs — filter by year using filteredTrips IDs
  const filteredTripIds = new Set(filteredTrips.map(r => r.id as string));
  const tripsPartsCost = tripPartsRows
    .filter(r => filteredTripIds.has(r.trip as string))
    .reduce((s, r) => s + ((Number(r.supplierPrice) || 0) * (Number(r.quantityRequired) || 1)), 0);
  const tripsTotalExpenses = tripsTravelExpenses + tripsPartsCost;

  // Support Ticket numbers
  const stPo     = sum(filteredSt, 'poAmount');
  const stBudget = sum(filteredSt, 'projectBudget');

  // Grand totals
  const totalRevenue  = oppWonQuoted + tripsInvoiced + stPo;
  const totalExpenses = tripsTotalExpenses + confTotalExpenses;
  const totalNet      = totalRevenue - totalExpenses;

  return (
    <Box>
      {/* Year filter */}
      <Flex align="center" gap={3} mb={6}>
        <Text fontWeight="semibold" whiteSpace="nowrap">Year:</Text>
        <Select maxW="200px" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
      </Flex>

      {/* Grand Summary */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="blue.400">
          <Stat>
            <StatLabel>Total Revenue</StatLabel>
            <StatNumber fontSize="xl">{fmt(totalRevenue)}</StatNumber>
            <StatHelpText>Won + Invoiced + ST PO</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="red.400">
          <Stat>
            <StatLabel>Total Expenses</StatLabel>
            <StatNumber fontSize="xl">{fmt(totalExpenses)}</StatNumber>
            <StatHelpText>TRIPS + Conference expenses</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="green.400">
          <Stat>
            <StatLabel>Net</StatLabel>
            <StatNumber fontSize="xl" color={totalNet >= 0 ? 'green.500' : 'red.500'}>{fmt(totalNet)}</StatNumber>
            <StatHelpText>Revenue − Expenses</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="purple.400">
          <Stat>
            <StatLabel>Open Pipeline</StatLabel>
            <StatNumber fontSize="xl">{fmt(oppOpenQuoted)}</StatNumber>
            <StatHelpText>Quoted (not yet won)</StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      <Divider mb={8} />

      {/* Opportunities */}
      <Section title="Opportunities" color="blue.600">
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={5}>
          <Stat><StatLabel>Open Quoted</StatLabel><StatNumber fontSize="lg">{fmt(oppOpenQuoted)}</StatNumber><StatHelpText>{openOpp.length} deals</StatHelpText></Stat>
          <Stat><StatLabel>Open TMXE</StatLabel><StatNumber fontSize="lg">{fmt(oppOpenTmxe)}</StatNumber></Stat>
          <Stat><StatLabel>Won Quoted</StatLabel><StatNumber fontSize="lg">{fmt(oppWonQuoted)}</StatNumber><StatHelpText>{wonOpp.length} deals</StatHelpText></Stat>
          <Stat><StatLabel>Won TMXE</StatLabel><StatNumber fontSize="lg">{fmt(oppWonTmxe)}</StatNumber></Stat>
        </SimpleGrid>
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Name</Th>
                <Th>Phase</Th>
                <Th isNumeric>Quoted Revenue</Th>
                <Th isNumeric>TMXE Revenue</Th>
                <Th isNumeric>PO Amount</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredOpp.map(r => (
                <Tr key={r.id as string} _hover={{ bg: rowHover }} cursor="pointer"
                  onClick={() => hailer!.ui.activity.open(r.id as string)}>
                  <Td maxW="250px" isTruncated fontWeight="medium">{r.name as string}</Td>
                  <Td><Badge colorScheme={r.phase === 'Closed - Won' ? 'green' : 'blue'}>{r.phase as string}</Badge></Td>
                  <Td isNumeric>{fmt(r.quotedRevenue)}</Td>
                  <Td isNumeric>{fmt(r.tmxeRevenue)}</Td>
                  <Td isNumeric>{fmt(r.poAmount)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Section>

      {/* TRIPS / IHS */}
      <Section title="TRIPS / IHS" color="purple.600">
        <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={5}>
          <Stat><StatLabel>Invoiced Amount</StatLabel><StatNumber fontSize="lg">{fmt(tripsInvoiced)}</StatNumber><StatHelpText>{filteredTrips.length} trips</StatHelpText></Stat>
          <Stat><StatLabel>PO Amount</StatLabel><StatNumber fontSize="lg">{fmt(tripsPo)}</StatNumber></Stat>
          <Stat><StatLabel>Total Expenses</StatLabel><StatNumber fontSize="lg" color="red.500">{fmt(tripsTotalExpenses)}</StatNumber></Stat>
        </SimpleGrid>
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Name</Th>
                <Th>Year</Th>
                <Th>Phase</Th>
                <Th isNumeric>Invoiced</Th>
                <Th isNumeric>Airfare</Th>
                <Th isNumeric>Hotel</Th>
                <Th isNumeric>Meals</Th>
                <Th isNumeric>Transport</Th>
                <Th isNumeric>Other</Th>
                <Th isNumeric>Parts</Th>
                <Th isNumeric>Total Exp.</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredTrips.map(r => {
                const tripParts = tripPartsRows.filter(p => p.trip === r.id);
                const partsCost = tripParts.reduce((s, p) => s + ((Number(p.supplierPrice) || 0) * (Number(p.quantityRequired) || 1)), 0);
                const tripExpenses = (Number(r.airfare) || 0) + (Number(r.hotel) || 0) + (Number(r.meals) || 0) + (Number(r.transportation) || 0) + (Number(r.other) || 0) + partsCost;
                return (
                  <Tr key={r.id as string} _hover={{ bg: rowHover }} cursor="pointer"
                    onClick={() => hailer!.ui.activity.open(r.id as string)}>
                    <Td maxW="200px" isTruncated fontWeight="medium">{r.name as string}</Td>
                    <Td>{r.yearOfService as string || '—'}</Td>
                    <Td><Badge colorScheme={r.phase === 'Closed' ? 'gray' : 'purple'}>{r.phase as string}</Badge></Td>
                    <Td isNumeric>{fmt(r.invoicedAmount)}</Td>
                    <Td isNumeric color="red.500">{fmt(r.airfare)}</Td>
                    <Td isNumeric color="red.500">{fmt(r.hotel)}</Td>
                    <Td isNumeric color="red.500">{fmt(r.meals)}</Td>
                    <Td isNumeric color="red.500">{fmt(r.transportation)}</Td>
                    <Td isNumeric color="red.500">{fmt(r.other)}</Td>
                    <Td isNumeric color="red.500">{partsCost > 0 ? fmt(partsCost) : '—'}</Td>
                    <Td isNumeric color="red.500" fontWeight="bold">{tripExpenses > 0 ? fmt(tripExpenses) : '—'}</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      </Section>

      {/* Conferences */}
      <Section title="Conferences" color="teal.600">
        <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={5}>
          <Stat><StatLabel>Total Expenses</StatLabel><StatNumber fontSize="lg" color="red.500">{fmt(confTotalExpenses)}</StatNumber><StatHelpText>{filteredConf.length} conferences — excludes cancelled</StatHelpText></Stat>
        </SimpleGrid>
        <Box bg={subtleBg} borderRadius="md" p={3} mb={5} border="1px" borderColor={borderColor}>
          <Heading size="xs" mb={2} color="gray.500">Expense Breakdown</Heading>
          <SimpleGrid columns={{ base: 3, md: 6 }} spacing={3}>
            <Stat><StatLabel fontSize="xs">Registration</StatLabel><StatNumber fontSize="md">{fmt(confRegistration)}</StatNumber></Stat>
            <Stat><StatLabel fontSize="xs">Hotel</StatLabel><StatNumber fontSize="md">{fmt(confHotel)}</StatNumber></Stat>
            <Stat><StatLabel fontSize="xs">Travel</StatLabel><StatNumber fontSize="md">{fmt(confTravel)}</StatNumber></Stat>
            <Stat><StatLabel fontSize="xs">Logistics</StatLabel><StatNumber fontSize="md">{fmt(confLogistics)}</StatNumber></Stat>
            <Stat><StatLabel fontSize="xs">Transportation</StatLabel><StatNumber fontSize="md">{fmt(confTransportation)}</StatNumber></Stat>
            <Stat><StatLabel fontSize="xs">Other</StatLabel><StatNumber fontSize="md">{fmt(confOther)}</StatNumber></Stat>
          </SimpleGrid>
        </Box>
        {filteredConf.length > 0 && (
          <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
            <Table variant="simple" size="sm">
              <Thead bg={theadBg}>
                <Tr>
                  <Th>Conference</Th>
                  <Th>Phase</Th>
                  <Th isNumeric>Registration</Th>
                  <Th isNumeric>Hotel</Th>
                  <Th isNumeric>Travel</Th>
                  <Th isNumeric>Logistics</Th>
                  <Th isNumeric>Transport</Th>
                  <Th isNumeric>Other</Th>
                  <Th isNumeric>Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredConf.map(r => {
                  const total = (Number(r.registrationCost) || 0) + (Number(r.hotelCost) || 0) +
                    (Number(r.travelCost) || 0) + (Number(r.logistics) || 0) +
                    (Number(r.transportationCost) || 0) + (Number(r.otherCost) || 0);
                  return (
                    <Tr key={r.id as string} _hover={{ bg: rowHover }} cursor="pointer"
                      onClick={() => hailer!.ui.activity.open(r.id as string)}>
                      <Td fontWeight="medium" maxW="200px" isTruncated>{r.name as string}</Td>
                      <Td><Badge colorScheme="teal">{r.phase as string}</Badge></Td>
                      <Td isNumeric>{fmt(r.registrationCost)}</Td>
                      <Td isNumeric>{fmt(r.hotelCost)}</Td>
                      <Td isNumeric>{fmt(r.travelCost)}</Td>
                      <Td isNumeric>{fmt(r.logistics)}</Td>
                      <Td isNumeric>{fmt(r.transportationCost)}</Td>
                      <Td isNumeric>{fmt(r.otherCost)}</Td>
                      <Td isNumeric fontWeight="bold">{fmt(total)}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </Section>

      {/* Support Tickets */}
      <Section title="Support Tickets (Billable Only)" color="orange.600">
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Stat>
            <StatLabel>Billable Tickets</StatLabel>
            <StatNumber>{filteredSt.length}</StatNumber>
            <StatHelpText>Open &amp; billable</StatHelpText>
          </Stat>
          <Stat>
            <StatLabel>Total PO Amount</StatLabel>
            <StatNumber fontSize="lg">{fmt(stPo)}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Total Project Budget</StatLabel>
            <StatNumber fontSize="lg">{fmt(stBudget)}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Avg PO per Ticket</StatLabel>
            <StatNumber fontSize="lg">{filteredSt.length > 0 ? fmt(stPo / filteredSt.length) : '—'}</StatNumber>
          </Stat>
        </SimpleGrid>
      </Section>
    </Box>
  );
}
