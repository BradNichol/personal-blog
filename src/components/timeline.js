import React from 'react';
import Timeline from '@material-ui/lab/Timeline';
import TimelineItem from '@material-ui/lab/TimelineItem';
import TimelineSeparator from '@material-ui/lab/TimelineSeparator';
import TimelineConnector from '@material-ui/lab/TimelineConnector';
import TimelineContent from '@material-ui/lab/TimelineContent';
import TimelineDot from '@material-ui/lab/TimelineDot';
import TimelineOppositeContent from '@material-ui/lab/TimelineOppositeContent';

function TimelineComponent () {

    return (
        <>
            <Timeline align="alternate">
                <TimelineItem>
                    <TimelineOppositeContent>
                        2017
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                        <TimelineDot />
                        <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent>
                        My coding journey began!
                    </TimelineContent>
                </TimelineItem>
            </Timeline>
        
        </>
    
    )
}

export default TimelineComponent