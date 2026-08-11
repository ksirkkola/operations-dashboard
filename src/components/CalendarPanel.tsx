import {
  Box, Flex, Heading, Spinner, Text, Badge, useColorModeValue,
  SimpleGrid, IconButton, HStack, VStack,
} from '@chakra-ui/react';
import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_TRIPS   = '6a4b93ac98da2dba3ba0bbf2';
const INSIGHT_OPP_CAL = '6a4ba19bfd37515ffb36e6eb';
const INSIGHT_LEADS   = '6a4ba1e4dfe8d813d937b99d';

// Conference workflow constants
const CONF_WORKFLOW = '6a192ecf0965f762b3ea50b9';
const CONF_PHASES   = [
  '6a192ed10965f762b3ea50e9', // New Conference
  '6a192ed10965f762b3ea50eb', // Done
  '6a192ed10965f762b3ea50ed', // ROI Review
  '6a192ed10965f762b3ea50ee', // Pre-event Outreach
  '6a192ed10965f762b3ea50ef', // Planning
  '6a192fd00965f762b3ea5f32', // Onsite Execution
  '6a192fdd0965f762b3ea604f', // Follow-up
];
const CONF_FIELD_DATES = '6a1c5c80c063208b5c4a4746'; // daterange
const CONF_FIELD_CODE  = '6a192ed10965f762b3ea5102';
const CONF_FIELD_LOC   = '6a1c5ccac063208b5c4a47dd';

interface CalEvent {
  id: string;
  startDate: Date;
  endDate: Date;
  label: string;
  sublabel: string;
  traveler: string;
  initials: string;
  type: 'trip' | 'conference' | 'opportunity' | 'reminder' | 'followup';
  phase: string;
}

interface FieldValue {
  fieldName: string;
  value: unknown;
}

interface Activity {
  _id: string;
  name: string;
  phaseId: string;
  currentPhase?: string;
  fields?: Record<string, unknown>;
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

// Insight timestamps are in seconds
function secToDate(val: unknown): Date | null {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n) || n === 0) return null;
  return new Date(n * 1000);
}

// SDK timestamps are in milliseconds
function msToDate(val: unknown): Date | null {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n) || n === 0) return null;
  return new Date(n);
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

interface Props { refreshKey?: number }
export default function CalendarPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const [tripsRows, setTripsRows]   = useState<Record<string, unknown>[]>([]);
  const [confEvents, setConfEvents] = useState<CalEvent[]>([]);
  const [oppRows, setOppRows]       = useState<Record<string, unknown>[]>([]);
  const [leadRows, setLeadRows]     = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const todayBg     = useColorModeValue('blue.50', 'blue.900');
  const headerBg    = useColorModeValue('gray.50', 'gray.800');
  const mutedText   = useColorModeValue('gray.400', 'gray.500');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);

    Promise.all([
      hailer!.insight.data(INSIGHT_TRIPS, { update: true }),
      hailer!.insight.data(INSIGHT_OPP_CAL, { update: true }),
      hailer!.insight.data(INSIGHT_LEADS, { update: true }),
      Promise.all(
        CONF_PHASES.map(phaseId =>
          hailer!.activity.list(CONF_WORKFLOW, phaseId, { limit: 200 }).catch(() => [])
        )
      ),
    ]).then(([trips, opps, leads, confResults]) => {
      setTripsRows(parseInsight(trips));
      setOppRows(parseInsight(opps));
      setLeadRows(parseInsight(leads));

      const allConf = confResults.flat() as Activity[];
      const events: CalEvent[] = [];

      for (const a of allConf) {
        const datesField = a.fields?.[CONF_FIELD_DATES] as { start?: number; end?: number } | null;
        if (!datesField || !datesField.start) continue;

        const startDate = msToDate(datesField.start);
        const endDate   = msToDate(datesField.end || datesField.start);
        if (!startDate || !endDate) continue;

        const codeField = a.fields?.[CONF_FIELD_CODE] as string || '';
        const locField  = a.fields?.[CONF_FIELD_LOC] as string || '';

        events.push({
          id: a._id,
          startDate,
          endDate,
          label: a.name,
          sublabel: locField,
          traveler: '',
          initials: '',
          type: 'conference',
          phase: a.phaseId || a.currentPhase || '',
        });
      }

      setConfEvents(events);
      setLoading(false);
    }).catch(err => {
      setError(String(err));
      setLoading(false);
    });
  }, [inside, refreshKey]);

  // Build TRIPS events
  const tripEvents = useMemo<CalEvent[]>(() => {
    return tripsRows
      .map(r => {
        const startDate = secToDate(r.arrivalDate);
        if (!startDate) return null;
        const days = Math.max(1, Number(r.daysOnsite) || 1);
        const endDate = new Date(startDate.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
        const traveler = r.assignedTraveler as string | null;
        const u = traveler ? user.map[traveler] : null;
        const name = u ? `${u.firstname} ${u.lastname}` : '';
        const initials = u ? `${u.firstname?.[0] || ''}${u.lastname?.[0] || ''}`.toUpperCase() : '';
        return {
          id: r.id as string,
          startDate,
          endDate,
          label: r.name as string || '',
          sublabel: String(r.serviceType || ''),
          traveler: name,
          initials,
          type: 'trip' as const,
          phase: r.phase as string,
        };
      })
      .filter(Boolean) as CalEvent[];
  }, [tripsRows, user.map]);

  // Opportunity close date events + 2-month and 3-week reminders
  const oppEvents = useMemo<CalEvent[]>(() => {
    const events: CalEvent[] = [];
    for (const r of oppRows) {
      const closeDate = secToDate(r.closeDate);
      if (!closeDate) continue;
      // Close date marker
      events.push({
        id: r.id as string,
        startDate: closeDate,
        endDate: closeDate,
        label: r.name as string || '',
        sublabel: `Close Date · ${r.phase}`,
        traveler: '', initials: '',
        type: 'opportunity',
        phase: r.phase as string,
      });
      // 2-month reminder
      const twoMonth = new Date(closeDate.getTime() - 60 * 24 * 60 * 60 * 1000);
      events.push({
        id: `${r.id}-2m`,
        startDate: twoMonth, endDate: twoMonth,
        label: `⏰ ${r.name}`,
        sublabel: '2-month reminder',
        traveler: '', initials: '',
        type: 'reminder',
        phase: r.phase as string,
      });
      // 3-week reminder
      const threeWeek = new Date(closeDate.getTime() - 21 * 24 * 60 * 60 * 1000);
      events.push({
        id: `${r.id}-3w`,
        startDate: threeWeek, endDate: threeWeek,
        label: `⏰ ${r.name}`,
        sublabel: '3-week reminder',
        traveler: '', initials: '',
        type: 'reminder',
        phase: r.phase as string,
      });
    }
    return events;
  }, [oppRows]);

  // Conference lead follow-up events — only New Lead phase
  const leadEvents = useMemo<CalEvent[]>(() => {
    return leadRows.map(r => {
      const date = secToDate(r.followUpDate);
      if (!date) return null;
      const assignedTo = r.assignedTo as string | null;
      const u = assignedTo ? user.map[assignedTo] : null;
      const name = u ? `${u.firstname} ${u.lastname}` : '';
      const initials = u ? `${u.firstname?.[0] || ''}${u.lastname?.[0] || ''}`.toUpperCase() : '';
      return {
        id: r.id as string,
        startDate: date, endDate: date,
        label: `Follow-up: ${r.name || r.company || ''}`,
        sublabel: name || (r.email as string || ''),
        traveler: name, initials,
        type: 'followup' as const,
        phase: r.phase as string,
      };
    }).filter(Boolean) as CalEvent[];
  }, [leadRows, user.map]);

  const allEvents = useMemo(() =>
    [...tripEvents, ...confEvents, ...oppEvents, ...leadEvents]
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    [tripEvents, confEvents, oppEvents, leadEvents]);

  // Calendar grid
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Events that span or start on a given day
  const eventsForDay = (day: number) => allEvents.filter(e => {
    const cellDate = new Date(year, month, day);
    return cellDate >= new Date(e.startDate.getFullYear(), e.startDate.getMonth(), e.startDate.getDate()) &&
           cellDate <= new Date(e.endDate.getFullYear(), e.endDate.getMonth(), e.endDate.getDate());
  });

  const todayStart = new Date(new Date().setHours(0,0,0,0));
  const upcoming = allEvents.filter(e => e.endDate >= todayStart);
  const overdue = allEvents.filter(e => e.type === 'followup' && e.endDate < todayStart)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  function fmtDateRange(e: CalEvent): string {
    const s = e.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (e.startDate.toDateString() === e.endDate.toDateString()) return s;
    const end = e.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${s} – ${end}`;
  }

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error: {error}</Text>;

  return (
    <Box>
      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>

        {/* Calendar grid */}
        <Box gridColumn={{ lg: 'span 2' }} bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" overflow="hidden">
          <Flex bg={headerBg} px={4} py={3} align="center" justify="space-between" borderBottom="1px" borderColor={borderColor}>
            <IconButton aria-label="Previous" size="sm" variant="ghost" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} icon={<Text>◀</Text>} />
            <Heading size="md">{MONTH_NAMES[month]} {year}</Heading>
            <IconButton aria-label="Next" size="sm" variant="ghost" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} icon={<Text>▶</Text>} />
          </Flex>

          <SimpleGrid columns={7} bg={headerBg} borderBottom="1px" borderColor={borderColor}>
            {DAY_NAMES.map(d => (
              <Box key={d} textAlign="center" py={2} fontSize="xs" fontWeight="bold" color={mutedText}>{d}</Box>
            ))}
          </SimpleGrid>

          <SimpleGrid columns={7} spacing={0}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <Box key={`e${i}`} minH="80px" border="1px" borderColor={borderColor} opacity={0.3} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
              const dayEvents = eventsForDay(day);
              return (
                <Box key={day} minH="80px" border="1px" borderColor={borderColor} bg={isToday ? todayBg : undefined} p={1}>
                  <Text fontSize="xs" fontWeight={isToday ? 'bold' : 'normal'} color={isToday ? 'blue.500' : undefined} mb={1}>{day}</Text>
                  <VStack spacing={1} align="stretch">
                    {dayEvents.map(e => (
                      <Box key={e.id} px={1} py={0.5} borderRadius="sm" fontSize="xs"
                        bg={e.type === 'trip' ? 'purple.100' : e.type === 'conference' ? 'teal.100' : e.type === 'opportunity' ? 'blue.100' : e.type === 'reminder' ? 'orange.100' : 'green.100'}
                        color={e.type === 'trip' ? 'purple.800' : e.type === 'conference' ? 'teal.800' : e.type === 'opportunity' ? 'blue.800' : e.type === 'reminder' ? 'orange.800' : 'green.800'}
                        cursor="pointer"
                        onClick={() => e.id.includes('-2m') || e.id.includes('-3w') ? hailer!.ui.activity.open(e.id.replace(/-2m|-3w/, '')) : hailer!.ui.activity.open(e.id)}
                        title={e.traveler ? `${e.label} — ${e.traveler}` : `${e.label} · ${e.sublabel}`}>
                        <Flex align="center" justify="space-between" gap={1}>
                          <Text isTruncated fontSize="xs">{e.label}</Text>
                          {e.initials && (
                            <Box flexShrink={0} w={4} h={4} borderRadius="full"
                              bg="purple.400" color="white"
                              fontSize="8px" fontWeight="bold"
                              display="flex" alignItems="center" justifyContent="center">
                              {e.initials}
                            </Box>
                          )}
                        </Flex>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>

        {/* Upcoming sidebar */}
        <Box>
          <Heading size="sm" mb={3} color="gray.500" textTransform="uppercase" letterSpacing="wide">Upcoming</Heading>
          <VStack spacing={3} align="stretch">
            {upcoming.length === 0 ? (
              <Text color="gray.500" fontSize="sm">No upcoming events.</Text>
            ) : (
              upcoming.slice(0, 5).map(e => (
                <Box key={e.id} bg={cardBg} border="1px" borderColor={borderColor}
                  borderLeft="4px solid"
                  borderLeftColor={e.type === 'trip' ? 'purple.400' : e.type === 'conference' ? 'teal.400' : e.type === 'opportunity' ? 'blue.400' : e.type === 'reminder' ? 'orange.400' : 'orange.400'}
                  borderRadius="md" p={3} cursor="pointer" shadow="sm"
                  onClick={() => e.id.includes('-2m') || e.id.includes('-3w') ? hailer!.ui.activity.open(e.id.replace(/-2m|-3w/, '')) : hailer!.ui.activity.open(e.id)}>
                  <HStack justify="space-between" mb={1}>
                    <Badge colorScheme={e.type === 'trip' ? 'purple' : e.type === 'conference' ? 'teal' : e.type === 'opportunity' ? 'blue' : e.type === 'reminder' ? 'orange' : 'green'} fontSize="xs">
                      {e.type === 'trip' ? 'TRIP' : e.type === 'conference' ? 'CONF' : e.type === 'opportunity' ? 'CLOSE' : e.type === 'reminder' ? 'REMIND' : 'FOLLOW-UP'}
                    </Badge>
                    <Text fontSize="xs" color={mutedText}>{fmtDateRange(e)}</Text>
                  </HStack>
                  <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{e.label}</Text>
                  {e.sublabel && <Text fontSize="xs" color={mutedText} noOfLines={1}>{e.sublabel}</Text>}
                  {e.traveler && (
                    <HStack mt={1} spacing={1}>
                      <Box w={5} h={5} borderRadius="full" bg="purple.400" color="white"
                        fontSize="9px" fontWeight="bold"
                        display="flex" alignItems="center" justifyContent="center">
                        {e.initials}
                      </Box>
                      <Text fontSize="xs" fontWeight="medium" color="purple.600">{e.traveler}</Text>
                    </HStack>
                  )}
                </Box>
              ))
            )}
          </VStack>
        </Box>
      </SimpleGrid>

      <HStack mt={4} spacing={4} flexWrap="wrap">
        <HStack><Box w={3} h={3} bg="purple.300" borderRadius="sm" /><Text fontSize="xs" color={mutedText}>TRIPS / IHS</Text></HStack>
        <HStack><Box w={3} h={3} bg="teal.300" borderRadius="sm" /><Text fontSize="xs" color={mutedText}>Conferences</Text></HStack>
        <HStack><Box w={3} h={3} bg="blue.300" borderRadius="sm" /><Text fontSize="xs" color={mutedText}>Opp Close Date</Text></HStack>
        <HStack><Box w={3} h={3} bg="orange.300" borderRadius="sm" /><Text fontSize="xs" color={mutedText}>Opp Reminder</Text></HStack>
        <HStack><Box w={3} h={3} bg="green.300" borderRadius="sm" /><Text fontSize="xs" color={mutedText}>Lead Follow-up</Text></HStack>
      </HStack>

      {overdue.length > 0 && (
        <Box mt={6}>
          <Heading size="sm" mb={3} color="red.500" textTransform="uppercase" letterSpacing="wide">Overdue Follow-ups (New Leads)</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
            {overdue.map(e => (
              <Box key={e.id} bg={cardBg} border="1px" borderColor="red.200"
                borderLeft="4px solid" borderLeftColor="red.400"
                borderRadius="md" p={3} cursor="pointer" shadow="sm"
                onClick={() => hailer!.ui.activity.open(e.id)}>
                <HStack justify="space-between" mb={1}>
                  <Badge colorScheme="red" fontSize="xs">OVERDUE</Badge>
                  <Text fontSize="xs" color="red.400">{fmtDateRange(e)}</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{e.label}</Text>
                {e.traveler && (
                  <HStack mt={1} spacing={1}>
                    <Box w={5} h={5} borderRadius="full" bg="red.400" color="white"
                      fontSize="9px" fontWeight="bold"
                      display="flex" alignItems="center" justifyContent="center">
                      {e.initials}
                    </Box>
                    <Text fontSize="xs" fontWeight="medium" color="red.500">{e.traveler}</Text>
                  </HStack>
                )}
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </Box>
  );
}
