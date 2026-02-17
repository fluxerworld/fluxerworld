/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

export const SAMPLE_REPORT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<report xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="https://report.cybertip.org/ispws/xsd">
    <incidentSummary>
        <incidentType>Child Pornography (possession, manufacture, and distribution)</incidentType>
        <reportAnnotations>
            <sextortion />
            <csamSolicitation />
            <minorToMinorInteraction />
            <spam />
            <sadisticOnlineExploitation />
        </reportAnnotations>
        <incidentDateTime>2012-10-15T08:00:00-07:00</incidentDateTime>
    </incidentSummary>
    <internetDetails>
        <webPageIncident>
            <url>http://badsite.com/baduri.html</url>
        </webPageIncident>
    </internetDetails>
    <reporter>
        <reportingPerson>
            <firstName>John</firstName>
            <lastName>Smith</lastName>
            <email>jsmith@example.com</email>
        </reportingPerson>
    </reporter>
</report>`;

export const INVALID_REPORT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<report xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="https://report.cybertip.org/ispws/xsd">
    <reporter>
        <reportingPerson>
            <firstName>John</firstName>
            <lastName>Smith</lastName>
            <email>jsmith@example.com</email>
        </reportingPerson>
    </reporter>
</report>`;

export const SAMPLE_FILE_DETAILS_XML = (
	reportId: string,
	fileId: string,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<fileDetails xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:noNamespaceSchemaLocation="https://report.cybertip.org/ispws/xsd">
    <reportId>${reportId}</reportId>
    <fileId>${fileId}</fileId>
    <originalFileName>mypic.jpg</originalFileName>
    <ipCaptureEvent>
        <ipAddress>63.116.246.17</ipAddress>
        <eventName>Upload</eventName>
        <dateTime>2011-10-31T12:00:00Z</dateTime>
    </ipCaptureEvent>
    <additionalInfo>File was originally posted with 6 others</additionalInfo>
</fileDetails>`;
