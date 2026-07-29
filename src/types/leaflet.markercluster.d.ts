declare module 'leaflet.markercluster' {
  import * as L from 'leaflet';

  interface MarkerClusterGroupOptions extends L.LayerOptions {
    chunkedLoading?: boolean;
    chunkInterval?: number;
    chunkDelay?: number;
    maxClusterRadius?: number | ((zoom: number) => number);
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    zoomToBoundsOnClick?: boolean;
    spiderfyDistanceMultiplier?: number;
    disableClusteringAtZoom?: number;
    removeOutsideVisibleBounds?: boolean;
    animate?: boolean;
    animateAddingMarkers?: boolean;
    singleMarkerMode?: boolean;
    polygonOptions?: L.PolylineOptions;
    spiderLegPolylineOptions?: L.PolylineOptions;
    spiderfyShapePositions?: (count: number, centerPoint: L.Point) => L.Point[];
    iconCreateFunction?: (cluster: MarkerCluster) => L.Icon | L.DivIcon;
  }

  interface MarkerCluster extends L.Layer {
    getChildCount(): number;
    getLatLng(): L.LatLng;
    getAllChildMarkers(): L.Marker[];
    spiderfy(): void;
    unspiderfy(): void;
  }

  class MarkerClusterGroup extends L.LayerGroup {
    constructor(options?: MarkerClusterGroupOptions);
  }

  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
}
