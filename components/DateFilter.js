'use client';

import { ref, computed, onMounted } from 'vue';

export default {
  name: 'DateFilter',
  emits: ['filter'],
  setup(props, { emit }) {
    const startDate = ref('');
    const endDate = ref('');
    const isLoading = ref(false);

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const handleFilter = async () => {
      isLoading.value = true;
      try {
        const start = startDate.value || thirtyDaysAgo;
        const end = endDate.value || today;

        const response = await fetch(
          `/api/gps-data?startDate=${start}&endDate=${end}`
        );
        const result = await response.json();

        if (result.success) {
          emit('filter', result.data);
        } else {
          console.error('Error fetching data:', result.error);
        }
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        isLoading.value = false;
      }
    };

    const handleReset = () => {
      startDate.value = '';
      endDate.value = '';
      emit('filter', []);
    };

    onMounted(() => {
      // Load initial data with default date range
      startDate.value = thirtyDaysAgo;
      endDate.value = today;
      handleFilter();
    });

    return {
      startDate,
      endDate,
      isLoading,
      handleFilter,
      handleReset,
    };
  },
  template: `
    <div class="bg-white shadow-lg rounded-lg p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">Filter GPS Data by Date</h2>
      
      <div class="flex flex-col md:flex-row gap-4 items-end">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Start Date
          </label>
          <input
            v-model="startDate"
            type="date"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            End Date
          </label>
          <input
            v-model="endDate"
            type="date"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div class="flex gap-2">
          <button
            @click="handleFilter"
            :disabled="isLoading"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {{ isLoading ? 'Loading...' : 'Filter' }}
          </button>
          
          <button
            @click="handleReset"
            class="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  `,
};
