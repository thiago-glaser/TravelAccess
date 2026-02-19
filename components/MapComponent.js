'use client';

import { ref, onMounted } from 'vue';

export default {
  name: 'MapComponent',
  props: {
    locations: {
      type: Array,
      default: () => [],
    },
  },
  setup(props) {
    const mapContainer = ref(null);
    const map = ref(null);
    const markers = ref([]);

    const initializeMap = () => {
      if (!mapContainer.value || !window.google) {
        console.error('Map container or Google Maps not available');
        return;
      }

      // Create map centered on a default location (New York)
      map.value = new window.google.maps.Map(mapContainer.value, {
        zoom: 10,
        center: { lat: 40.7128, lng: -74.006 },
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
      });

      // Clear existing markers
      markers.value.forEach(marker => marker.setMap(null));
      markers.value = [];

      // Add new markers for locations
      if (props.locations && props.locations.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();

        props.locations.forEach((location, index) => {
          const position = {
            lat: location.lat,
            lng: location.lng,
          };

          const marker = new window.google.maps.Marker({
            position,
            map: map.value,
            title: location.name || `Location ${index + 1}`,
            label: String(index + 1),
          });

          // Create info window
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div class="p-2">
                <h3 class="font-bold">${location.name || 'Location'}</h3>
                <p class="text-sm">Date: ${new Date(location.date).toLocaleDateString()}</p>
                <p class="text-sm">Lat: ${location.lat.toFixed(4)}</p>
                <p class="text-sm">Lng: ${location.lng.toFixed(4)}</p>
              </div>
            `,
          });

          marker.addListener('click', () => {
            // Close all other info windows
            markers.value.forEach(m => {
              if (m.infoWindow) {
                m.infoWindow.close();
              }
            });
            infoWindow.open(map.value, marker);
          });

          marker.infoWindow = infoWindow;
          markers.value.push(marker);
          bounds.extend(position);
        });

        // Fit map to show all markers
        if (props.locations.length > 1) {
          map.value.fitBounds(bounds);
        } else {
          map.value.setCenter(markers.value[0].getPosition());
          map.value.setZoom(13);
        }
      }
    };

    onMounted(() => {
      // Load Google Maps API
      if (!window.google) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
        script.async = true;
        script.defer = true;
        script.onload = initializeMap;
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    });

    // Watch for location changes
    const watchLocations = () => {
      initializeMap();
    };

    return {
      mapContainer,
      watchLocations,
    };
  },
  watch: {
    locations: {
      handler() {
        this.watchLocations();
      },
      deep: true,
    },
  },
  template: `
    <div class="bg-white shadow-lg rounded-lg overflow-hidden">
      <div class="h-96 md:h-screen w-full" ref="mapContainer">
        <!-- Map will be rendered here -->
      </div>
    </div>
  `,
};
