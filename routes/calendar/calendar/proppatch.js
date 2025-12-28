const _ = require('lodash');
const xml = require('../../../common/xml');
const {
  build,
  multistatus,
  response,
  status
} = require('../../../common/x-build');
const { setMissingMethod } = require('../../../common/response');
const commonTags = require('../../../common/tags');

// Protected properties that cannot be modified via PROPPATCH
// Per RFC 4791 Section 5.2.3 and related sections
const PROTECTED_PROPERTIES = new Set([
  'supported-calendar-component-set',
  'supported-calendar-data',
  'max-resource-size',
  'min-date-time',
  'max-date-time',
  'max-instances',
  'max-attendees-per-instance',
  'getctag', // CalendarServer extension, typically read-only
  'getetag',
  'getcontenttype',
  'getcontentlength',
  'getlastmodified',
  'creationdate',
  'resourcetype',
  'sync-token',
  'current-user-privilege-set',
  'owner',
  'supported-report-set'
]);

// Properties that can be modified via PROPPATCH
const MODIFIABLE_PROPERTIES = new Set([
  'displayname',
  'calendar-description',
  'calendar-timezone',
  'calendar-color',
  'calendar-order'
]);

/**
 * Validate VTIMEZONE content per RFC 4791 Section 5.2.2
 * The calendar-timezone property MUST be a valid iCalendar object
 * containing exactly one valid VTIMEZONE component.
 * @param {string} value - The timezone value to validate
 * @returns {{valid: boolean, error: string|null}} - Validation result
 */
function validateCalendarTimezone(value) {
  // Empty value is valid (clearing the timezone)
  if (!value || value.trim() === '') {
    return { valid: true, error: null };
  }

  // Must contain VCALENDAR wrapper
  if (!value.includes('BEGIN:VCALENDAR') || !value.includes('END:VCALENDAR')) {
    return {
      valid: false,
      error:
        'calendar-timezone must be a valid iCalendar object (missing VCALENDAR)'
    };
  }

  // Must contain exactly one VTIMEZONE component
  const vtimezoneCount = (value.match(/BEGIN:VTIMEZONE/g) || []).length;
  if (vtimezoneCount === 0) {
    return {
      valid: false,
      error: 'calendar-timezone must contain a VTIMEZONE component'
    };
  }

  if (vtimezoneCount > 1) {
    return {
      valid: false,
      error: 'calendar-timezone must contain exactly one VTIMEZONE component'
    };
  }

  // Must have matching END:VTIMEZONE
  const endVtimezoneCount = (value.match(/END:VTIMEZONE/g) || []).length;
  if (vtimezoneCount !== endVtimezoneCount) {
    return {
      valid: false,
      error: 'calendar-timezone has malformed VTIMEZONE component'
    };
  }

  // Must have TZID property
  if (!value.includes('TZID:') && !value.includes('TZID;')) {
    return {
      valid: false,
      error: 'VTIMEZONE component must have a TZID property'
    };
  }

  return { valid: true, error: null };
}

/**
 * Extract xml:lang attribute from an element
 * Per RFC 4791 Section 5.2.1: Language tagging information appearing
 * in the scope of the 'prop' element MUST be persistently stored
 * @param {Element} child - XML element node
 * @returns {string|null} - The xml:lang value or null
 */
function extractXmlLang(child) {
  // Check for xml:lang attribute on the element itself
  if (child.getAttributeNS) {
    const lang = child.getAttributeNS(
      'http://www.w3.org/XML/1998/namespace',
      'lang'
    );
    if (lang) return lang;
  }

  // Check for xml:lang attribute using getAttribute
  if (child.getAttribute) {
    const lang = child.getAttribute('xml:lang');
    if (lang) return lang;
  }

  // Walk up the tree to find inherited xml:lang
  let parent = child.parentNode;
  while (parent && parent.getAttribute) {
    const lang = parent.getAttribute('xml:lang');
    if (lang) return lang;
    parent = parent.parentNode;
  }

  return null;
}

/**
 * Process a 'set' property and return the update object
 * @param {Element} child - XML element node
 * @param {Array} validationErrors - Array to collect validation errors
 * @returns {Object|null} - Update object or null if not handled
 */
function processSetProperty(child, validationErrors) {
  const xmlLang = extractXmlLang(child);

  switch (child.localName) {
    case 'displayname': {
      // Allow empty string to clear the display name
      const result = { name: child.textContent };
      if (xmlLang) result.nameXmlLang = xmlLang;
      return result;
    }

    case 'calendar-description': {
      // Allow empty string to clear the description
      // Per RFC 4791 Section 5.2.1, calendar-description is (#PCDATA)
      const result = { description: child.textContent };
      if (xmlLang) result.descriptionXmlLang = xmlLang;
      return result;
    }

    case 'calendar-timezone': {
      // Validate timezone per RFC 4791 Section 5.2.2
      const validation = validateCalendarTimezone(child.textContent);
      if (!validation.valid) {
        validationErrors.push({
          child,
          error: validation.error,
          precondition: 'valid-calendar-data'
        });
        return null;
      }

      return { timezone: child.textContent };
    }

    case 'calendar-color': {
      // Allow empty string to clear the color
      return { color: child.textContent };
    }

    case 'calendar-order': {
      // For numeric values, parse if content exists, otherwise set to null
      return {
        order: child.textContent ? Number.parseInt(child.textContent, 10) : null
      };
    }

    default: {
      return null;
    }
  }
}

/**
 * Process a 'remove' property and return the update object
 * Per RFC 4918 Section 14.23: removing sets property to empty/null
 * @param {Element} child - XML element node
 * @returns {Object|null} - Update object or null if not handled
 */
function processRemoveProperty(child) {
  switch (child.localName) {
    case 'displayname': {
      return { name: '', nameXmlLang: null };
    }

    case 'calendar-description': {
      return { description: '', descriptionXmlLang: null };
    }

    case 'calendar-timezone': {
      return { timezone: '' };
    }

    case 'calendar-color': {
      return { color: '' };
    }

    case 'calendar-order': {
      return { order: null };
    }

    default: {
      // Per RFC 4918: removing non-existent property is not an error
      return null;
    }
  }
}

/**
 * Build error response for protected property modification attempt
 * Per RFC 4918 Section 9.2: atomicity requires all or nothing
 * @param {string} url - Request URL
 * @param {Array} allChildren - All property children
 * @param {Array} protectedErrors - Protected property elements
 * @returns {string} - XML response
 */
function buildProtectedPropertyErrorResponse(
  url,
  allChildren,
  protectedErrors
) {
  const responses = allChildren.map(({ child }) => {
    const propName = `${child.prefix || 'D'}:${child.localName}`;
    if (protectedErrors.includes(child)) {
      // Return 403 for protected properties
      return response(url, status[403], [{ [propName]: '' }]);
    }

    // Return 424 Failed Dependency for other properties
    return response(url, status[424], [{ [propName]: '' }]);
  });

  return build(multistatus(_.compact(responses)));
}

/**
 * Build error response for validation failures
 * Per RFC 4918 Section 9.2: atomicity requires all or nothing
 * @param {string} url - Request URL
 * @param {Array} allChildren - All property children
 * @param {Array} validationErrors - Validation error objects
 * @returns {string} - XML response
 */
function buildValidationErrorResponse(url, allChildren, validationErrors) {
  const errorChildren = new Set(validationErrors.map((e) => e.child));
  const responses = allChildren.map(({ child }) => {
    const propName = `${child.prefix || 'D'}:${child.localName}`;
    if (errorChildren.has(child)) {
      // Return 409 Conflict for validation errors (per RFC 4791 Section 5.3.2.1)
      return response(url, status[409], [{ [propName]: '' }]);
    }

    // Return 424 Failed Dependency for other properties
    return response(url, status[424], [{ [propName]: '' }]);
  });

  return build(multistatus(_.compact(responses)));
}

module.exports = function (options) {
  const tags = commonTags(options);

  const exec = async function (ctx, calendar) {
    if (calendar.readonly) {
      setMissingMethod(ctx);
      return;
    }

    //
    // Per RFC 4918 Section 9.2:
    // - Servers MUST process PROPPATCH instructions in document order
    // - Instructions MUST either all be executed or none executed (atomicity)
    // - The propertyupdate element can contain both 'set' and 'remove' instructions
    //
    const { children: setChildren } = xml.getWithChildren(
      '/D:propertyupdate/D:set/D:prop',
      ctx.request.xml
    );

    const { children: removeChildren } = xml.getWithChildren(
      '/D:propertyupdate/D:remove/D:prop',
      ctx.request.xml
    );

    const updates = {};
    const protectedErrors = [];
    const validationErrors = [];
    const allChildren = [];

    // Process 'set' instructions
    for (const child of setChildren) {
      if (!child.localName) continue;
      allChildren.push({ child, action: 'set' });

      if (PROTECTED_PROPERTIES.has(child.localName)) {
        protectedErrors.push(child);
        continue;
      }

      const update = processSetProperty(child, validationErrors);
      if (update) {
        Object.assign(updates, update);
      }
    }

    // Process 'remove' instructions
    for (const child of removeChildren) {
      if (!child.localName) continue;
      allChildren.push({ child, action: 'remove' });

      if (PROTECTED_PROPERTIES.has(child.localName)) {
        protectedErrors.push(child);
        continue;
      }

      const update = processRemoveProperty(child);
      if (update) {
        Object.assign(updates, update);
      }
    }

    //
    // Atomicity check: If any errors, fail entire request
    // Per RFC 4918 Section 9.2: "Instructions MUST either all be executed or none executed"
    //

    // Check for protected property errors first
    if (protectedErrors.length > 0) {
      return buildProtectedPropertyErrorResponse(
        ctx.url,
        allChildren,
        protectedErrors
      );
    }

    // Check for validation errors (e.g., invalid timezone)
    if (validationErrors.length > 0) {
      // Log validation errors for debugging
      for (const { child, error } of validationErrors) {
        const err = new Error(
          `CalDAV PROPPATCH validation error for ${child.localName}: ${error}`
        );
        err.isCodeBug = false;
        console.warn(err.message);
        if (ctx.logger) ctx.logger.warn(err.message);
      }

      return buildValidationErrorResponse(
        ctx.url,
        allChildren,
        validationErrors
      );
    }

    // Log warning for unhandled properties
    const unhandledProps = allChildren
      .filter(
        ({ child }) =>
          child.localName &&
          !MODIFIABLE_PROPERTIES.has(child.localName) &&
          !PROTECTED_PROPERTIES.has(child.localName)
      )
      .map(({ child }) => child.localName);

    if (unhandledProps.length > 0) {
      const err = new TypeError(
        `CalDAV PROPPATCH unhandled properties: ${unhandledProps.join(', ')}`
      );
      err.isCodeBug = true;
      err.str = ctx.request.body;
      err.xml = ctx.request.xml;
      console.error(err);
      if (ctx.logger) ctx.logger.error(err);
    }

    //
    // Apply updates atomically
    // The updateCalendar function should handle rollback on failure
    //
    let updatedCalendar = calendar;
    if (!_.isEmpty(updates)) {
      try {
        updatedCalendar = await options.data.updateCalendar(ctx, {
          principalId: ctx.state.params.principalId,
          calendarId: ctx.state.params.calendarId,
          user: ctx.state.user,
          updates
        });
      } catch (err) {
        // If update fails, return 500 for all properties (atomicity)
        console.error('CalDAV PROPPATCH update failed:', err);
        if (ctx.logger)
          ctx.logger.error('CalDAV PROPPATCH update failed:', err);

        const responses = allChildren.map(({ child }) => {
          const propName = `${child.prefix || 'D'}:${child.localName}`;
          return response(ctx.url, status[500], [{ [propName]: '' }]);
        });

        return build(multistatus(_.compact(responses)));
      }
    }

    // Build response for each property
    const actions = allChildren.map(async ({ child }) => {
      return tags.getResponse({
        resource: 'calendarProppatch',
        child,
        ctx,
        calendar: updatedCalendar
      });
    });
    const res = await Promise.all(actions);

    const ms = multistatus(_.compact(res));
    return build(ms);
  };

  return {
    exec
  };
};
