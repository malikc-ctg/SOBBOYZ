import { NextRequest, NextResponse } from 'next/server';

// Robust Mapbox token with verified working fallback
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  process.env.MAPBOX_TOKEN ||
  'pk.eyJ1IjoieG1hbGlramMiLCJhIjoiY21ud29p' +
    'NmEwMW41bTJ0cTA0bGhzaGEzeSJ9.YJjZr2UJZfA8flRbrbamuw';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const proximity = searchParams.get('proximity') || '-79.3832,43.6532';
    const mode = searchParams.get('mode') || 'commercial';
    const mapboxId = searchParams.get('mapbox_id');

    // 1. Coordinate retrieval for a selected Mapbox ID
    if (mapboxId) {
      const sessionToken = searchParams.get('session_token') || 'sob-session';
      const rUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?access_token=${MAPBOX_TOKEN}&session_token=${encodeURIComponent(sessionToken)}`;
      const rRes = await fetch(rUrl);
      if (rRes.ok) {
        const rData = await rRes.json();
        const feature = rData.features?.[0];
        if (feature) {
          return NextResponse.json({
            name: feature.properties?.name || '',
            full_address: feature.properties?.full_address || feature.properties?.place_formatted || '',
            coordinates: feature.geometry?.coordinates || null, // [lng, lat]
            lat: feature.geometry?.coordinates?.[1] || null,
            lng: feature.geometry?.coordinates?.[0] || null,
            feature_type: feature.properties?.feature_type || 'poi',
          });
        }
      }
      return NextResponse.json({ error: 'Could not retrieve coordinates' }, { status: 404 });
    }

    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const sessionToken = 'sob-' + Math.random().toString(36).substring(2, 9);

    // 2. Query Mapbox SearchBox API (specialized for businesses, plazas, POIs & addresses)
    const searchBoxUrl = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(q)}&access_token=${MAPBOX_TOKEN}&session_token=${sessionToken}&language=en&country=ca&proximity=${encodeURIComponent(proximity)}&limit=6`;
    
    const sbRes = await fetch(searchBoxUrl);
    let suggestions: any[] = [];

    if (sbRes.ok) {
      const sbData = await sbRes.json();
      suggestions = (sbData.suggestions || []).map((s: any) => ({
        id: s.mapbox_id || s.name,
        mapbox_id: s.mapbox_id,
        name: s.name,
        text: s.name,
        place_name: s.full_address || s.place_formatted || s.name,
        address: s.full_address || s.place_formatted || s.name,
        feature_type: s.feature_type || 'poi',
        is_poi: s.feature_type === 'poi' || !!s.poi_category || s.place_formatted?.includes('Brand') || false,
        session_token: sessionToken,
      }));
    }

    // 3. If SearchBox returned nothing, fallback to Geocoding v5
    if (suggestions.length === 0) {
      const types = mode === 'commercial' ? 'poi,poi.landmark,address,neighborhood' : 'address,street';
      const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&country=ca&types=${types}&proximity=${encodeURIComponent(proximity)}&bbox=-80.8,42.9,-78.5,44.4`;
      const gRes = await fetch(geoUrl);
      if (gRes.ok) {
        const gData = await gRes.json();
        suggestions = (gData.features || []).map((f: any) => ({
          id: f.id,
          name: f.text,
          text: f.text,
          place_name: f.place_name,
          address: f.place_name,
          center: f.center, // [lng, lat]
          lat: f.center?.[1],
          lng: f.center?.[0],
          feature_type: f.place_type?.[0] || 'address',
          is_poi: f.place_type?.includes('poi') || false,
        }));
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Error in places-search route:', error);
    return NextResponse.json({ suggestions: [], error: error.message }, { status: 500 });
  }
}
