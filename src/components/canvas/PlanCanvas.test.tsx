import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test: Stream response parsing with various Claude responses
 *
 * This test reproduces the "0 surfaces" issue by simulating different
 * responses from the Claude API streaming endpoint.
 */

describe('PlanCanvas - Stream Response Parsing', () => {
  // Helper to simulate stream parsing logic (extracted from PlanCanvas)
  const parseStreamResponse = (streamText: string) => {
    const lines = streamText.split('\n');
    const surfaces: any[] = [];
    const errors: any[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'error') {
          errors.push(parsed);
          continue;
        }
        if (parsed.type === 'scale') {
          continue;
        }
        // Assume it's a surface
        surfaces.push(parsed);
      } catch (e) {
        console.warn('Parse error on line:', line.substring(0, 80), e);
      }
    }
    return { surfaces, errors };
  };

  it('should parse valid NDJSON with multiple surfaces', () => {
    const response = `{"label":"Kitchen Floor","surface":"floor","dimensionNote":"12'-6\\" x 14'-2\\"","estimatedSqft":177}
{"label":"Kitchen Backsplash","surface":"backsplash","dimensionNote":"estimated","estimatedSqft":32}`;

    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(surfaces[0].label).toBe('Kitchen Floor');
  });

  it('should handle empty response (0 surfaces)', () => {
    const response = '';
    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(0);
    expect(errors).toHaveLength(0);
    // ❌ PROBLEM: No surfaces found, but also no error shown to user!
  });

  it('should handle response with only scale info (no surfaces)', () => {
    const response = `{"type":"scale","note":"1/4\\" = 1'-0\\""}`;
    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(0);
    expect(errors).toHaveLength(0);
    // ❌ PROBLEM: Scale info parsed but silently discarded
  });

  it('should handle response with only empty lines', () => {
    const response = `

`;
    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(0);
    expect(errors).toHaveLength(0);
    // ❌ PROBLEM: Empty response yields 0 surfaces with no indication
  });

  it('should handle API error response', () => {
    const response = `{"type":"error","message":"overloaded_error"}`;
    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('overloaded_error');
  });

  it('should handle malformed JSON (missing closing brace)', () => {
    const response = `{"label":"Kitchen Floor","surface":"floor"
{"label":"Kitchen Backsplash","surface":"backsplash","dimensionNote":"estimated","estimatedSqft":32}`;

    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(1); // Only second surface parsed
    expect(errors).toHaveLength(0);
    // ❌ PROBLEM: First surface silently dropped, user never notified
  });

  it('should handle response where Claude refuses to analyze', () => {
    const response = `I cannot analyze this image as it does not appear to be an architectural floor plan. Please upload a clear floor plan with labeled dimensions.`;

    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(0);
    expect(errors).toHaveLength(0);
    // ❌ PROBLEM: Claude's explanation is lost, user gets "0 surfaces" with no reason
  });

  it('should handle response with surfaces missing required fields', () => {
    const response = `{"label":"Kitchen Floor","surface":"floor"}
{"surface":"backsplash","dimensionNote":"estimated","estimatedSqft":32}`;

    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(2);
    // ❌ PROBLEM: Second surface missing "label" field but still accepted
    expect(surfaces[1].label).toBeUndefined();
  });

  it('should handle response with invalid surface type', () => {
    const response = `{"label":"Unknown","surface":"invalid_type","dimensionNote":"test","estimatedSqft":100}`;

    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(1);
    // ❌ PROBLEM: Invalid surface type accepted without validation
    expect(surfaces[0].surface).toBe('invalid_type');
  });

  it('should handle response with null/invalid estimatedSqft', () => {
    const response = `{"label":"Kitchen","surface":"floor","dimensionNote":"test","estimatedSqft":null}`;

    const { surfaces, errors } = parseStreamResponse(response);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].estimatedSqft).toBeNull();
    // ❌ PROBLEM: Null sqft accepted, will cause calculation errors later
  });
});
